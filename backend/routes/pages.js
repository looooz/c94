const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, degrees } = require('pdf-lib');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

const processSinglePDF = async (file, operation, options) => {
  const pdfBytes = fs.readFileSync(file.path);
  const pdf = await PDFDocument.load(pdfBytes);
  const totalPages = pdf.getPageCount();
  const baseName = path.basename(file.originalname, path.extname(file.originalname));
  
  let resultPdf = null;
  let resultInfo = {};

  if (operation === 'delete') {
    const { pagesToDelete } = options;
    const pagesToDeleteArr = pagesToDelete.split(',').map(p => parseInt(p.trim()) - 1);
    const validPages = pagesToDeleteArr.filter(p => p >= 0 && p < totalPages);
    const pagesToKeep = [];
    
    for (let i = 0; i < totalPages; i++) {
      if (!validPages.includes(i)) {
        pagesToKeep.push(i);
      }
    }

    if (pagesToKeep.length === 0) {
      throw new Error('Cannot delete all pages');
    }

    resultPdf = await PDFDocument.create();
    const copiedPages = await resultPdf.copyPages(pdf, pagesToKeep);
    copiedPages.forEach(page => resultPdf.addPage(page));
    resultInfo = {
      pagesDeleted: validPages.length,
      pagesRemaining: pagesToKeep.length
    };
  } else if (operation === 'rotate') {
    const { pagesToRotate, rotation } = options;
    const pagesToRotateArr = pagesToRotate === 'all' ? 'all' : 
      pagesToRotate.split(',').map(p => parseInt(p.trim()) - 1);
    const rotationNum = parseInt(rotation);
    const pages = pdf.getPages();

    pages.forEach((page, idx) => {
      const shouldRotate = pagesToRotateArr === 'all' || pagesToRotateArr.includes(idx);
      if (shouldRotate && idx >= 0 && idx < totalPages) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + rotationNum) % 360));
      }
    });

    resultPdf = pdf;
    resultInfo = { rotation: rotationNum };
  } else if (operation === 'extract') {
    const { pagesToExtract } = options;
    const pagesToExtractArr = pagesToExtract.split(',').map(p => parseInt(p.trim()) - 1);
    const validPages = pagesToExtractArr.filter(p => p >= 0 && p < totalPages);
    
    if (validPages.length === 0) {
      throw new Error('No valid pages to extract');
    }

    resultPdf = await PDFDocument.create();
    const copiedPages = await resultPdf.copyPages(pdf, validPages);
    copiedPages.forEach(page => resultPdf.addPage(page));
    resultInfo = { pagesExtracted: validPages.length };
  } else if (operation === 'reorder') {
    const { newOrder } = options;
    let newOrderArr;
    try {
      newOrderArr = JSON.parse(newOrder).map(p => parseInt(p) - 1);
    } catch (e) {
      newOrderArr = newOrder.split(',').map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n));
    }
    const validOrder = newOrderArr.filter(p => p >= 0 && p < totalPages);
    
    if (validOrder.length !== totalPages) {
      throw new Error('Invalid page order');
    }

    resultPdf = await PDFDocument.create();
    const copiedPages = await resultPdf.copyPages(pdf, validOrder);
    copiedPages.forEach(page => resultPdf.addPage(page));
    resultInfo = {};
  }

  const resultBytes = await resultPdf.save();
  const outputFileName = `${operation}_${baseName}_${uuidv4().slice(0, 8)}.pdf`;

  return {
    originalName: file.originalname,
    outputFileName,
    resultBytes,
    resultInfo,
    totalPages
  };
};

const handleBatchOperation = async (req, res, operation, optionFields) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one PDF file' });
    }

    const files = req.files;
    const options = {};
    optionFields.forEach(field => {
      if (req.body[field] !== undefined) {
        options[field] = req.body[field];
      }
    });

    const sessionId = uuidv4();
    const sessionDir = path.join(outputDir, sessionId);
    fs.ensureDirSync(sessionDir);

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await processSinglePDF(file, operation, options);
        const outputPath = path.join(sessionDir, result.outputFileName);
        fs.writeFileSync(outputPath, result.resultBytes);
        const fileSize = fs.statSync(outputPath).size;
        results.push({
          originalName: result.originalName,
          outputFileName: result.outputFileName,
          fileSize,
          resultInfo: result.resultInfo,
          totalPages: result.totalPages,
          success: true
        });
      } catch (err) {
        console.error(`Error processing ${file.originalname}:`, err);
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
      return res.status(500).json({ error: `Failed to ${operation} any PDF files` });
    }

    if (successResults.length === 1) {
      const singleResult = successResults[0];
      const srcPath = path.join(sessionDir, singleResult.outputFileName);
      const destPath = path.join(outputDir, singleResult.outputFileName);
      fs.moveSync(srcPath, destPath, { overwrite: true });
      fs.removeSync(sessionDir);

      const historyRecord = addHistory({
        type: `pages-${operation}`,
        fileName: singleResult.outputFileName,
        originalName: `${operation}_${singleResult.originalName}`,
        fileSize: singleResult.fileSize,
        filePath: `output/${singleResult.outputFileName}`,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        ...singleResult.resultInfo
      });

      return res.json({
        success: true,
        isBatch: false,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        fileName: singleResult.outputFileName,
        fileSize: singleResult.fileSize,
        ...singleResult.resultInfo,
        historyId: historyRecord.id,
        results
      });
    }

    const zipName = `pages_${operation}_batch_${sessionId}.zip`;
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
      type: `pages-${operation}`,
      fileName: zipName,
      originalName: `pages_${operation}_batch_${successResults.length}_files.zip`,
      fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
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
    console.error(`Pages ${operation} error:`, error);
    res.status(500).json({ error: `Failed to ${operation} pages: ` + error.message });
  }
};

router.post('/delete', upload.array('pdfs', 20), async (req, res) => {
  await handleBatchOperation(req, res, 'delete', ['pagesToDelete']);
});

router.post('/rotate', upload.array('pdfs', 20), async (req, res) => {
  await handleBatchOperation(req, res, 'rotate', ['pagesToRotate', 'rotation']);
});

router.post('/extract', upload.array('pdfs', 20), async (req, res) => {
  await handleBatchOperation(req, res, 'extract', ['pagesToExtract']);
});

router.post('/reorder', upload.array('pdfs', 20), async (req, res) => {
  await handleBatchOperation(req, res, 'reorder', ['newOrder']);
});

module.exports = router;
