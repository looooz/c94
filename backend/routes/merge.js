const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

router.post('/', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Please upload at least 2 PDF files' });
    }

    const order = req.body.order ? JSON.parse(req.body.order) : null;
    let files = req.files;
    
    if (order && order.length === files.length) {
      files = order.map(idx => files[idx]).filter(Boolean);
    }

    const mergedPdf = await PDFDocument.create();
    
    for (const file of files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
      fs.removeSync(file.path);
    }

    const mergedPdfBytes = await mergedPdf.save();
    const outputFileName = `merged_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, mergedPdfBytes);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'merge',
      fileName: outputFileName,
      originalName: `merged_${files.length}_files.pdf`,
      fileSize: fileSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      fileSize: fileSize,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Failed to merge PDFs: ' + error.message });
  }
});

module.exports = router;
