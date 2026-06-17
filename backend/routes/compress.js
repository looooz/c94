const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { level = 'medium' } = req.body;
    const originalSize = fs.statSync(req.file.path).size;
    
    const pdfBytes = fs.readFileSync(req.file.path);
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
    const outputFileName = `compressed_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, compressedBytes);

    const compressedSize = fs.statSync(outputPath).size;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    fs.removeSync(req.file.path);

    const historyRecord = addHistory({
      type: 'compress',
      fileName: outputFileName,
      originalName: `compressed_${req.file.originalname}`,
      fileSize: compressedSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`,
      originalSize: originalSize,
      compressedSize: compressedSize,
      compressionRatio: compressionRatio
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      originalSize: originalSize,
      compressedSize: compressedSize,
      compressionRatio: compressionRatio,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ error: 'Failed to compress PDF: ' + error.message });
  }
});

module.exports = router;
