const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
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

const getWatermarkPositions = (pageWidth, pageHeight, position, watermarkWidth, watermarkHeight, margin = 30, spacingMultiplier = 1.0) => {
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
      const spacingX = baseSpacingX * spacingMultiplier;
      const spacingY = baseSpacingY * spacingMultiplier;
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
      const fullSpacingX = baseFullSpacingX * spacingMultiplier;
      const fullSpacingY = baseFullSpacingY * spacingMultiplier;
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

router.post('/', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'watermarkImage', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const pdfFile = req.files.pdf[0];
    const watermarkImageFile = req.files.watermarkImage ? req.files.watermarkImage[0] : null;

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
      watermarkSpacing = 1.0
    } = req.body;

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
        return res.status(400).json({ error: 'Invalid watermark image' });
      }
      fs.removeSync(watermarkImageFile.path);
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
        return res.status(400).json({ error: 'Chinese text watermark requires image generation. Please use the frontend to generate the watermark image.' });
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
        return res.status(400).json({ error: 'Invalid watermark image for Chinese text' });
      }
      fs.removeSync(watermarkImageFile.path);
    }

    for (const page of pages) {
      const { width: pageWidth, height: pageHeight } = page.getSize();

      if (type === 'text' && !hasChinese && watermarkFont) {
        const positions = getWatermarkPositions(pageWidth, pageHeight, position, textWidth, textHeight, 30, parseFloat(watermarkSpacing) || 1.0);

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
        const positions = getWatermarkPositions(pageWidth, pageHeight, position, watermarkImgWidth, watermarkImgHeight, 30, parseFloat(watermarkSpacing) || 1.0);

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
    const outputFileName = `watermarked_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, watermarkedBytes);

    fs.removeSync(pdfFile.path);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'watermark',
      fileName: outputFileName,
      originalName: `watermarked_${pdfFile.originalname}`,
      fileSize: fileSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`,
      watermarkType: type
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      fileSize: fileSize,
      previewUrl: `/download/${outputFileName}`,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: 'Failed to add watermark: ' + error.message });
  }
});

module.exports = router;
