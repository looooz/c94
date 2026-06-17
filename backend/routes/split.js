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

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { mode, pagesPerFile, ranges, specificPages } = req.body;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    let splitFiles = [];

    if (mode === 'pagesPerFile') {
      const n = parseInt(pagesPerFile) || 5;
      for (let i = 0; i < totalPages; i += n) {
        const newPdf = await PDFDocument.create();
        const end = Math.min(i + n, totalPages);
        const pages = await newPdf.copyPages(pdf, Array.from({ length: end - i }, (_, j) => i + j));
        pages.forEach(page => newPdf.addPage(page));
        splitFiles.push({ pdf: newPdf, name: `pages_${i + 1}-${end}.pdf` });
      }
    } else if (mode === 'ranges') {
      const rangeList = ranges.split(',').map(r => r.trim());
      for (const range of rangeList) {
        const [start, end] = range.split('-').map(n => parseInt(n) - 1);
        if (start >= 0 && end < totalPages && start <= end) {
          const newPdf = await PDFDocument.create();
          const pages = await newPdf.copyPages(pdf, Array.from({ length: end - start + 1 }, (_, j) => start + j));
          pages.forEach(page => newPdf.addPage(page));
          splitFiles.push({ pdf: newPdf, name: `pages_${start + 1}-${end + 1}.pdf` });
        }
      }
    } else if (mode === 'specific') {
      const pageList = specificPages.split(',').map(p => parseInt(p.trim()) - 1).filter(p => p >= 0 && p < totalPages);
      for (const pageNum of pageList) {
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, [pageNum]);
        pages.forEach(page => newPdf.addPage(page));
        splitFiles.push({ pdf: newPdf, name: `page_${pageNum + 1}.pdf` });
      }
    }

    if (splitFiles.length === 0) {
      fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'No pages to extract' });
    }

    const sessionId = uuidv4();
    const sessionDir = path.join(outputDir, sessionId);
    fs.ensureDirSync(sessionDir);

    const savedFiles = [];
    for (const file of splitFiles) {
      const pdfBytes = await file.pdf.save();
      const filePath = path.join(sessionDir, file.name);
      fs.writeFileSync(filePath, pdfBytes);
      savedFiles.push({ name: file.name, path: filePath, size: fs.statSync(filePath).size });
    }

    const zipName = `split_${sessionId}.zip`;
    const zipPath = path.join(outputDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    savedFiles.forEach(file => {
      archive.file(file.path, { name: file.name });
    });
    await archive.finalize();

    fs.removeSync(req.file.path);
    fs.removeSync(sessionDir);

    const fileSize = fs.statSync(zipPath).size;
    const historyRecord = addHistory({
      type: 'split',
      fileName: zipName,
      originalName: `split_${req.file.originalname}`,
      fileSize: fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      fileCount: savedFiles.length
    });

    res.json({
      success: true,
      downloadUrl: `/download/${zipName}`,
      fileName: zipName,
      fileSize: fileSize,
      fileCount: savedFiles.length,
      files: savedFiles.map(f => ({ name: f.name, size: f.size })),
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Split error:', error);
    res.status(500).json({ error: 'Failed to split PDF: ' + error.message });
  }
});

module.exports = router;
