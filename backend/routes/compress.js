const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

const compressSinglePDF = async (file, level) => {
  const originalSize = fs.statSync(file.path).size;

  const pdfBytes = fs.readFileSync(file.path);
  const pdf = await PDFDocument.load(pdfBytes);

  let compressionOptions = {
    useObjectStreams: true,
    addDefaultPage: false
  };

  if (level === 'high') {
    const pages = pdf.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      const contentStream = page.node.getContents();
      if (contentStream) {
        try {
          const operators = contentStream.operators;
        } catch (e) {}
      }
    }
  }

  const compressedBytes = await pdf.save(compressionOptions);
  const baseName = path.basename(file.originalname, path.extname(file.originalname));
  const outputFileName = `compressed_${baseName}_${uuidv4().slice(0, 8)}.pdf`;

  return {
    originalName: file.originalname,
    outputFileName,
    originalSize,
    compressedBytes,
    level
  };
};

router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one PDF file' });
    }

    const { level = 'medium' } = req.body;
    const files = req.files;

    const sessionId = uuidv4();
    const sessionDir = path.join(outputDir, sessionId);
    fs.ensureDirSync(sessionDir);

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await compressSinglePDF(file, level);
        const outputPath = path.join(sessionDir, result.outputFileName);
        fs.writeFileSync(outputPath, result.compressedBytes);
        const compressedSize = fs.statSync(outputPath).size;
        const compressionRatio = ((1 - compressedSize / result.originalSize) * 100).toFixed(2);
        results.push({
          originalName: result.originalName,
          outputFileName: result.outputFileName,
          originalSize: result.originalSize,
          compressedSize,
          compressionRatio,
          success: true
        });
      } catch (err) {
        console.error(`Error compressing ${file.originalname}:`, err);
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
      return res.status(500).json({ error: 'Failed to compress any PDF files' });
    }

    if (successResults.length === 1) {
      const singleResult = successResults[0];
      const srcPath = path.join(sessionDir, singleResult.outputFileName);
      const destPath = path.join(outputDir, singleResult.outputFileName);
      fs.moveSync(srcPath, destPath, { overwrite: true });
      fs.removeSync(sessionDir);

      const historyRecord = addHistory({
        type: 'compress',
        fileName: singleResult.outputFileName,
        originalName: `compressed_${singleResult.originalName}`,
        fileSize: singleResult.compressedSize,
        filePath: `output/${singleResult.outputFileName}`,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        originalSize: singleResult.originalSize,
        compressedSize: singleResult.compressedSize,
        compressionRatio: singleResult.compressionRatio
      });

      return res.json({
        success: true,
        isBatch: false,
        downloadUrl: `/download/${singleResult.outputFileName}`,
        fileName: singleResult.outputFileName,
        originalSize: singleResult.originalSize,
        compressedSize: singleResult.compressedSize,
        compressionRatio: singleResult.compressionRatio,
        historyId: historyRecord.id,
        results
      });
    }

    const zipName = `compressed_batch_${sessionId}.zip`;
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
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    successResults.forEach(r => {
      totalOriginalSize += r.originalSize;
      totalCompressedSize += r.compressedSize;
    });
    const overallCompressionRatio = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(2);

    const historyRecord = addHistory({
      type: 'compress',
      fileName: zipName,
      originalName: `compressed_batch_${successResults.length}_files.zip`,
      fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      compressionRatio: overallCompressionRatio,
      fileCount: successResults.length
    });

    res.json({
      success: true,
      isBatch: true,
      downloadUrl: `/download/${zipName}`,
      fileName: zipName,
      fileSize,
      fileCount: successResults.length,
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      compressionRatio: overallCompressionRatio,
      historyId: historyRecord.id,
      results
    });
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ error: 'Failed to compress PDF: ' + error.message });
  }
});

module.exports = router;
