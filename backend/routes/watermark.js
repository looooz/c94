const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

const parseColor = (colorStr) => {
  if (!colorStr) return { r: 0, g: 0, b: 0 };
  if (colorStr.startsWith('#')) {
    const r = parseInt(colorStr.slice(1, 3), 16);
    const g = parseInt(colorStr.slice(3, 5), 16);
    const b = parseInt(colorStr.slice(5, 7), 16);
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
};

const getWatermarkPositions = (pageWidth, pageHeight, position, watermarkWidth, watermarkHeight, margin = 30, spacingXMultiplier = 1.0, spacingYMultiplier = 1.0) => {
  const positions = [];
  const centerX = (pageWidth - watermarkWidth) / 2;
  const centerY = (pageHeight - watermarkHeight) / 2;
  const left = margin;
  const right = pageWidth - watermarkWidth - margin;
  const top = pageHeight - watermarkHeight - margin;
  const bottom = margin;

  switch (position) {
    case 'top-left':
      positions.push({ x: left, y: top });
      break;
    case 'top-center':
      positions.push({ x: centerX, y: top });
      break;
    case 'top-right':
      positions.push({ x: right, y: top });
      break;
    case 'center-left':
      positions.push({ x: left, y: centerY });
      break;
    case 'center':
      positions.push({ x: centerX, y: centerY });
      break;
    case 'center-right':
      positions.push({ x: right, y: centerY });
      break;
    case 'bottom-left':
      positions.push({ x: left, y: bottom });
      break;
    case 'bottom-center':
      positions.push({ x: centerX, y: bottom });
      break;
    case 'bottom-right':
      positions.push({ x: right, y: bottom });
      break;
    case 'tiled': {
      const baseSpacingX = watermarkWidth * 1.6;
      const baseSpacingY = watermarkHeight * 2.5;
      const spacingX = baseSpacingX * spacingXMultiplier;
      const spacingY = baseSpacingY * spacingYMultiplier;
      const cols = Math.ceil(pageWidth / spacingX) + 4;
      const rows = Math.ceil(pageHeight / spacingY) + 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const offsetX = r % 2 === 0 ? 0 : spacingX / 2;
          positions.push({
            x: c * spacingX - watermarkWidth * 1.5 + offsetX,
            y: r * spacingY - watermarkHeight * 1.5,
            rotate: -30
          });
        }
      }
      break;
    }
    case 'full-tiled': {
      const baseFullSpacingX = watermarkWidth * 1.2;
      const baseFullSpacingY = watermarkHeight * 2.0;
      const fullSpacingX = baseFullSpacingX * spacingXMultiplier;
      const fullSpacingY = baseFullSpacingY * spacingYMultiplier;
      const fullCols = Math.ceil(pageWidth / fullSpacingX) + 4;
      const fullRows = Math.ceil(pageHeight / fullSpacingY) + 4;
      for (let r = 0; r < fullRows; r++) {
        for (let c = 0; c < fullCols; c++) {
          const offsetX = r % 2 === 0 ? 0 : fullSpacingX / 2;
          positions.push({
            x: c * fullSpacingX - watermarkWidth * 2 + offsetX,
            y: r * fullSpacingY - watermarkHeight * 1.5,
            rotate: -45
          });
        }
      }
      break;
    }
    default:
      positions.push({ x: centerX, y: centerY });
  }
  return positions;
};

const addWatermarkToSinglePDF = async (pdfFile, options, watermarkImageFile) => {
  const {
    type = 'text',
    text = 'CONFIDENTIAL',
    fontSize = 48,
    color = '#ff0000',
    opacity = 0.3,
    position = 'center',
    rotation = 0,
    fontFamily = 'Helvetica',
    imageScale = 0.5,
    watermarkSpacingX = 1.0,
    watermarkSpacingY = 1.0
  } = options;

  const pdfBytes = fs.readFileSync(pdfFile.path);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const opacityNum = parseFloat(opacity) || 0.3;
  const fontSizeNum = parseInt(fontSize) || 48;
  const rotationNum = parseInt(rotation) || 0;
  const watermarkColor = parseColor(color);

  let embeddedWatermarkImage = null;
  let watermarkImgWidth = 0;
  let watermarkImgHeight = 0;
  let useImageMode = (type === 'image' && watermarkImageFile);

  if (useImageMode && watermarkImageFile) {
    const imgBytes = fs.readFileSync(watermarkImageFile.path);
    try {
      if (watermarkImageFile.mimetype === 'image/png') {
        embeddedWatermarkImage = await pdfDoc.embedPng(imgBytes);
      } else {
        embeddedWatermarkImage = await pdfDoc.embedJpg(imgBytes);
      }
      const scale = parseFloat(imageScale) || 0.5;
      watermarkImgWidth = embeddedWatermarkImage.width * scale;
      watermarkImgHeight = embeddedWatermarkImage.height * scale;
    } catch (e) {
      throw new Error('Invalid watermark image');
    }
  }

  let watermarkFont;
  let textWidth = 0;
  let textHeight = fontSizeNum;
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);

  if (type === 'text' && !hasChinese) {
    try {
      const fontMap = {
        'Helvetica': StandardFonts.Helvetica,
        'Helvetica-Bold': StandardFonts.HelveticaBold,
        'Times-Roman': StandardFonts.TimesRoman,
        'Times-Bold': StandardFonts.TimesRomanBold,
        'Courier': StandardFonts.Courier,
        'Courier-Bold': StandardFonts.CourierBold
      };
      watermarkFont = await pdfDoc.embedFont(fontMap[fontFamily] || StandardFonts.Helvetica);
      textWidth = watermarkFont.widthOfTextAtSize(text, fontSizeNum);
    } catch (e) {
      watermarkFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      textWidth = watermarkFont.widthOfTextAtSize(text, fontSizeNum);
    }
  } else if (type === 'text' && hasChinese) {
    if (!watermarkImageFile) {
      throw new Error('Chinese text watermark requires image generation');
    }
    const imgBytes = fs.readFileSync(watermarkImageFile.path);
    try {
      if (watermarkImageFile.mimetype === 'image/png') {
        embeddedWatermarkImage = await pdfDoc.embedPng(imgBytes);
      } else {
        embeddedWatermarkImage = await pdfDoc.embedJpg(imgBytes);
      }
      const scale = parseFloat(imageScale) || 1.0;
      watermarkImgWidth = embeddedWatermarkImage.width * scale;
      watermarkImgHeight = embeddedWatermarkImage.height * scale;
      useImageMode = true;
    } catch (e) {
      throw new Error('Invalid watermark image for Chinese text');
    }
  }

  for (const page of pages) {
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (type === 'text' && !hasChinese && watermarkFont) {
      const positions = getWatermarkPositions(pageWidth, pageHeight, position, textWidth, textHeight, 30, parseFloat(watermarkSpacingX) || 1.0, parseFloat(watermarkSpacingY) || 1.0);

      for (const pos of positions) {
        const rotateAngle = pos.rotate !== undefined ? pos.rotate : rotationNum;
        page.drawText(text, {
          x: pos.x,
          y: pos.y,
          size: fontSizeNum,
          font: watermarkFont,
          color: rgb(watermarkColor.r / 255, watermarkColor.g / 255, watermarkColor.b / 255),
          opacity: opacityNum,
          rotate: degrees(rotateAngle)
        });
      }
    } else if (useImageMode && embeddedWatermarkImage) {
      const positions = getWatermarkPositions(pageWidth, pageHeight, position, watermarkImgWidth, watermarkImgHeight, 30, parseFloat(watermarkSpacingX) || 1.0, parseFloat(watermarkSpacingY) || 1.0);

      for (const pos of positions) {
        const rotateAngle = pos.rotate !== undefined ? pos.rotate : rotationNum;
        page.drawImage(embeddedWatermarkImage, {
          x: pos.x,
          y: pos.y,
          width: watermarkImgWidth,
          height: watermarkImgHeight,
          opacity: opacityNum,
          rotate: degrees(rotateAngle)
        });
      }
    }
  }

  const watermarkedBytes = await pdfDoc.save();
  const baseName = path.basename(pdfFile.originalname, path.extname(pdfFile.originalname));
  const outputFileName = `watermarked_${baseName}_${uuidv4().slice(0, 8)}.pdf`;

  return {
    originalName: pdfFile.originalname,
    outputFileName,
    watermarkedBytes
  };
};

router.post('/', upload.fields([{ name: 'pdfs', maxCount: 20 }, { name: 'watermarkImage', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files.pdfs || req.files.pdfs.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one PDF file' });
    }

    const pdfFiles = req.files.pdfs;
    const watermarkImageFile = req.files.watermarkImage ? req.files.watermarkImage[0] : null;

    const options = {
      type: req.body.type || 'text',
      text: req.body.text || 'CONFIDENTIAL',
      fontSize: req.body.fontSize || 48,
      color: req.body.color || '#ff0000',
      opacity: req.body.opacity || 0.3,
      position: req.body.position || 'center',
      rotation: req.body.rotation || 0,
      fontFamily: req.body.fontFamily || 'Helvetica',
      imageScale: req.body.imageScale || 0.5,
      watermarkSpacingX: req.body.watermarkSpacingX || 1.0,
      watermarkSpacingY: req.body.watermarkSpacingY || 1.0
    };

    const hasChinese = /[\u4e00-\u9fa5]/.test(options.text);

    if (options.type === 'text' && hasChinese && !watermarkImageFile) {
      return res.status(400).json({ error: 'Chinese text watermark requires image generation. Please use the frontend to generate the watermark image.' });
    }

    const sessionId = uuidv4();
    const sessionDir = path.join(outputDir, sessionId);
    fs.ensureDirSync(sessionDir);

    const results = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const pdfFile = pdfFiles[i];
      try {
        const result = await addWatermarkToSinglePDF(pdfFile, options, watermarkImageFile);
        const outputPath = path.join(sessionDir, result.outputFileName);
        fs.writeFileSync(outputPath, result.watermarkedBytes);
        const fileSize = fs.statSync(outputPath).size;
        results.push({
          originalName: result.originalName,
          outputFileName: result.outputFileName,
          fileSize,
          success: true
        });
      } catch (err) {
        console.error(`Error adding watermark to ${pdfFile.originalname}:`, err);
        results.push({
          originalName: pdfFile.originalname,
          success: false,
          error: err.message
        });
      } finally {
        if (fs.existsSync(pdfFile.path)) {
          fs.removeSync(pdfFile.path);
        }
      }
    }

    if (watermarkImageFile && fs.existsSync(watermarkImageFile.path)) {
      fs.removeSync(watermarkImageFile.path);
    }

    const successResults = results.filter(r => r.success);
    if (successResults.length === 0) {
      fs.removeSync(sessionDir);
      return res.status(500).json({ error: 'Failed to add watermark to any PDF files' });
    }

    if (successResults.length === 1) {
      const singleResult = successResults[0];
      const srcPath = path.join(sessionDir, singleResult.outputFileName);
      const destPath = path.join(outputDir, singleResult.outputFileName);
      fs.moveSync(srcPath, destPath, { overwrite: true });
      fs.removeSync(sessionDir);

      const historyRecord = addHistory({
        type: 'watermark',
        fileName: singleResult.outputFileName,
        originalName: `watermarked_${singleResult.originalName}`,
        fileSize: singleResult.fileSize,
        filePath: `output/${singleResult.outputFileName}`,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        watermarkType: options.type
      });

      return res.json({
        success: true,
        isBatch: false,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        fileName: singleResult.outputFileName,
        fileSize: singleResult.fileSize,
        previewUrl: `/download/${singleResult.outputFileName}`,
        historyId: historyRecord.id,
        results
      });
    }

    const zipName = `watermarked_batch_${sessionId}.zip`;
    const zipPath = path.join(outputDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    successResults.forEach(r => {
      const filePath = path.join(sessionDir, r.outputFileName);
      archive.file(filePath, { name: r.outputFileName });
    });
    await archive.finalize();

    fs.removeSync(sessionDir);

    const fileSize = fs.statSync(zipPath).size;
    let totalFileSize = 0;
    successResults.forEach(r => {
      totalFileSize += r.fileSize;
    });

    const historyRecord = addHistory({
      type: 'watermark',
      fileName: zipName,
      originalName: `watermarked_batch_${successResults.length}_files.zip`,
      fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      watermarkType: options.type,
      fileCount: successResults.length
    });

    res.json({
      success: true,
      isBatch: true,
      downloadUrl: `/download/${zipName}`,
      fileName: zipName,
      fileSize,
      fileCount: successResults.length,
      historyId: historyRecord.id,
      results
    });
  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: 'Failed to add watermark: ' + error.message });
  }
});

module.exports = router;
