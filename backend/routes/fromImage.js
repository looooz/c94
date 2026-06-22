const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

const PAGE_SIZES = {
  A4: { width: 595, height: 842 },
  A3: { width: 842, height: 1191 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 }
};

const getImageInfo = (filePath, mimetype) => {
  try {
    const buffer = fs.readFileSync(filePath);
    
    if (mimetype === 'image/png') {
      const png = PNG.sync.read(buffer);
      return { width: png.width, height: png.height, format: 'png' };
    } else if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      const jpg = jpeg.decode(buffer);
      return { width: jpg.width, height: jpg.height, format: 'jpg' };
    }
    
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      const png = PNG.sync.read(buffer);
      return { width: png.width, height: png.height, format: 'png' };
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      const jpg = jpeg.decode(buffer);
      return { width: jpg.width, height: jpg.height, format: 'jpg' };
    }
    
    return { width: 800, height: 600, format: 'unknown' };
  } catch (e) {
    console.log('Image info parse error:', e.message);
    return { width: 800, height: 600, format: 'unknown' };
  }
};

router.post('/batch', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length < 1) {
      return res.status(400).json({ error: 'Please upload at least one image' });
    }

    const {
      pageSize = 'A4',
      margin = 20,
      customWidth,
      customHeight,
      fit = 'contain'
    } = req.body;

    let targetSize = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    if (pageSize === 'custom' && customWidth && customHeight) {
      targetSize = { width: parseInt(customWidth), height: parseInt(customHeight) };
    }

    const marginNum = parseInt(margin) || 20;
    const contentWidth = targetSize.width - marginNum * 2;
    const contentHeight = targetSize.height - marginNum * 2;

    const files = req.files;
    const sessionId = uuidv4();
    const sessionDir = path.join(outputDir, sessionId);
    fs.ensureDirSync(sessionDir);

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const imageBuffer = fs.readFileSync(file.path);
        const imageInfo = getImageInfo(file.path, file.mimetype);

        const page = pdfDoc.addPage([targetSize.width, targetSize.height]);

        let imgWidth = imageInfo.width || 800;
        let imgHeight = imageInfo.height || 600;

        const scaleX = contentWidth / imgWidth;
        const scaleY = contentHeight / imgHeight;
        let scale = Math.min(scaleX, scaleY);

        if (fit === 'fill') {
          scale = Math.max(scaleX, scaleY);
        }

        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const x = marginNum + (contentWidth - drawWidth) / 2;
        const y = marginNum + (contentHeight - drawHeight) / 2;

        let embeddedImage;
        let embeddedSuccess = false;

        try {
          if (imageInfo.format === 'png') {
            embeddedImage = await pdfDoc.embedPng(imageBuffer);
            embeddedSuccess = true;
          } else if (imageInfo.format === 'jpg') {
            embeddedImage = await pdfDoc.embedJpg(imageBuffer);
            embeddedSuccess = true;
          } else {
            try {
              embeddedImage = await pdfDoc.embedPng(imageBuffer);
              embeddedSuccess = true;
            } catch (e1) {
              try {
                embeddedImage = await pdfDoc.embedJpg(imageBuffer);
                embeddedSuccess = true;
              } catch (e2) {
                embeddedSuccess = false;
              }
            }
          }

          if (embeddedSuccess && embeddedImage) {
            page.drawImage(embeddedImage, {
              x: x,
              y: y,
              width: drawWidth,
              height: drawHeight
            });
          }
        } catch (err) {
          embeddedSuccess = false;
        }

        if (!embeddedSuccess) {
          page.drawRectangle({
            x: x,
            y: y,
            width: drawWidth,
            height: drawHeight,
            color: rgb(0.95, 0.95, 0.95),
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 1
          });

          page.drawText(file.originalname, {
            x: x + 10,
            y: y + drawHeight / 2,
            size: 12,
            font: helveticaFont,
            color: rgb(0.5, 0.5, 0.5)
          });
        }

        const baseName = path.basename(file.originalname, path.extname(file.originalname));
        const outputFileName = `${baseName}_${uuidv4().slice(0, 8)}.pdf`;
        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join(sessionDir, outputFileName);
        fs.writeFileSync(outputPath, pdfBytes);
        const fileSize = fs.statSync(outputPath).size;

        results.push({
          originalName: file.originalname,
          outputFileName,
          fileSize,
          success: true
        });
      } catch (err) {
        console.error(`Error converting ${file.originalname}:`, err);
        results.push({
          originalName: file.originalname,
          success: false,
          error: err.message
        });
      } finally {
        if (fs.existsSync(file.path)) {
          fs.removeSync(file.path);
        }
      }
    }

    const successResults = results.filter(r => r.success);
    if (successResults.length === 0) {
      fs.removeSync(sessionDir);
      return res.status(500).json({ error: 'Failed to convert any images to PDF' });
    }

    if (successResults.length === 1) {
      const singleResult = successResults[0];
      const srcPath = path.join(sessionDir, singleResult.outputFileName);
      const destPath = path.join(outputDir, singleResult.outputFileName);
      fs.moveSync(srcPath, destPath, { overwrite: true });
      fs.removeSync(sessionDir);

      const historyRecord = addHistory({
        type: 'fromImage',
        fileName: singleResult.outputFileName,
        originalName: `pdf_from_${singleResult.originalName}`,
        fileSize: singleResult.fileSize,
        filePath: `output/${singleResult.outputFileName}`,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        imageCount: 1,
        pageSize: pageSize
      });

      return res.json({
        success: true,
        isBatch: false,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        fileName: singleResult.outputFileName,
        fileSize: singleResult.fileSize,
        pageCount: 1,
        historyId: historyRecord.id,
        results
      });
    }

    const zipName = `images_to_pdf_batch_${sessionId}.zip`;
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
      type: 'fromImage',
      fileName: zipName,
      originalName: `images_to_pdf_batch_${successResults.length}_files.zip`,
      fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      imageCount: successResults.length,
      pageSize: pageSize,
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
    console.error('FromImage batch error:', error);
    res.status(500).json({ error: 'Failed to convert images to PDF: ' + error.message });
  }
});

router.post('/', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length < 1) {
      return res.status(400).json({ error: 'Please upload at least one image' });
    }

    const { 
      pageSize = 'A4', 
      margin = 20, 
      order,
      customWidth,
      customHeight,
      fit = 'contain'
    } = req.body;

    let targetSize = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
    if (pageSize === 'custom' && customWidth && customHeight) {
      targetSize = { width: parseInt(customWidth), height: parseInt(customHeight) };
    }

    const marginNum = parseInt(margin) || 20;
    const contentWidth = targetSize.width - marginNum * 2;
    const contentHeight = targetSize.height - marginNum * 2;

    let files = req.files;
    if (order) {
      let orderArr;
      try {
        orderArr = JSON.parse(order);
      } catch (e) {
        orderArr = order.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      }
      if (Array.isArray(orderArr) && orderArr.length === files.length) {
        files = orderArr.map(idx => files[idx]).filter(Boolean);
      }
    }

    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const file of files) {
      const imageBuffer = fs.readFileSync(file.path);
      const imageInfo = getImageInfo(file.path, file.mimetype);

      const page = pdfDoc.addPage([targetSize.width, targetSize.height]);
      
      let imgWidth = imageInfo.width || 800;
      let imgHeight = imageInfo.height || 600;
      
      const scaleX = contentWidth / imgWidth;
      const scaleY = contentHeight / imgHeight;
      let scale = Math.min(scaleX, scaleY);
      
      if (fit === 'fill') {
        scale = Math.max(scaleX, scaleY);
      }
      
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const x = marginNum + (contentWidth - drawWidth) / 2;
      const y = marginNum + (contentHeight - drawHeight) / 2;

      let embeddedImage;
      let embeddedSuccess = false;
      
      try {
        if (imageInfo.format === 'png') {
          embeddedImage = await pdfDoc.embedPng(imageBuffer);
          embeddedSuccess = true;
        } else if (imageInfo.format === 'jpg') {
          embeddedImage = await pdfDoc.embedJpg(imageBuffer);
          embeddedSuccess = true;
        } else {
          try {
            embeddedImage = await pdfDoc.embedPng(imageBuffer);
            embeddedSuccess = true;
          } catch (e1) {
            try {
              embeddedImage = await pdfDoc.embedJpg(imageBuffer);
              embeddedSuccess = true;
            } catch (e2) {
              embeddedSuccess = false;
            }
          }
        }
        
        if (embeddedSuccess && embeddedImage) {
          page.drawImage(embeddedImage, {
            x: x,
            y: y,
            width: drawWidth,
            height: drawHeight
          });
        }
      } catch (err) {
        embeddedSuccess = false;
      }
      
      if (!embeddedSuccess) {
        page.drawRectangle({
          x: x,
          y: y,
          width: drawWidth,
          height: drawHeight,
          color: rgb(0.95, 0.95, 0.95),
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 1
        });
        
        page.drawText(file.originalname, {
          x: x + 10,
          y: y + drawHeight / 2,
          size: 12,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
      }

      fs.removeSync(file.path);
    }

    const pdfBytes = await pdfDoc.save();
    const outputFileName = `images_to_pdf_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, pdfBytes);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'fromImage',
      fileName: outputFileName,
      originalName: `pdf_from_${files.length}_images.pdf`,
      fileSize: fileSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`,
      imageCount: files.length,
      pageSize: pageSize
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      fileSize: fileSize,
      pageCount: files.length,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('FromImage error:', error);
    res.status(500).json({ error: 'Failed to convert images to PDF: ' + error.message });
  }
});

module.exports = router;
