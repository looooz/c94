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

const splitSinglePDF = async (file, options) => {
  const { mode, pagesPerFile, ranges, specificPages } = options;
  const pdfBytes = fs.readFileSync(file.path);
  const pdf = await PDFDocument.load(pdfBytes);
  const totalPages = pdf.getPageCount();
  
  let splitFiles = [];
  const baseName = path.basename(file.originalname, path.extname(file.originalname));

  if (mode === 'pagesPerFile') {
    const n = parseInt(pagesPerFile) || 5;
    for (let i = 0; i < totalPages; i += n) {
      const newPdf = await PDFDocument.create();
      const end = Math.min(i + n, totalPages);
      const pages = await newPdf.copyPages(pdf, Array.from({ length: end - i }, (_, j) => i + j));
      pages.forEach(page => newPdf.addPage(page));
      splitFiles.push({ pdf: newPdf, name: `${baseName}_pages_${i + 1}-${end}.pdf` });
    }
  } else if (mode === 'ranges') {
    const rangeList = ranges.split(',').map(r => r.trim());
    for (const range of rangeList) {
      const [start, end] = range.split('-').map(n => parseInt(n) - 1);
      if (start >= 0 && end < totalPages && start <= end) {
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, Array.from({ length: end - start + 1 }, (_, j) => start + j));
        pages.forEach(page => newPdf.addPage(page));
        splitFiles.push({ pdf: newPdf, name: `${baseName}_pages_${start + 1}-${end + 1}.pdf` });
      }
    }
  } else if (mode === 'specific') {
    const pageList = specificPages.split(',').map(p => parseInt(p.trim()) - 1).filter(p => p >= 0 && p < totalPages);
    for (const pageNum of pageList) {
      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdf, [pageNum]);
      pages.forEach(page => newPdf.addPage(page));
      splitFiles.push({ pdf: newPdf, name: `${baseName}_page_${pageNum + 1}.pdf` });
    }
  }

  if (splitFiles.length === 0) {
    throw new Error('No pages to extract');
  }

  const sessionId = uuidv4();
  const sessionDir = path.join(outputDir, sessionId);
  fs.ensureDirSync(sessionDir);

  const savedFiles = [];
  for (const f of splitFiles) {
    const pdfBytes = await f.pdf.save();
    const filePath = path.join(sessionDir, f.name);
    fs.writeFileSync(filePath, pdfBytes);
    savedFiles.push({ name: f.name, path: filePath, size: fs.statSync(filePath).size });
  }

  return {
    originalName: file.originalname,
    baseName,
    sessionId,
    sessionDir,
    savedFiles,
    totalPages
  };
};

router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one PDF file' });
    }

    const { mode, pagesPerFile, ranges, specificPages } = req.body;
    const files = req.files;
    const options = { mode, pagesPerFile, ranges, specificPages };

    const batchSessionId = uuidv4();
    const allSplitFiles = [];
    const results = [];
    const tempDirs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await splitSinglePDF(file, options);
        tempDirs.push(result.sessionDir);
        result.savedFiles.forEach(f => {
          allSplitFiles.push({
            ...f,
            archiveName: `${result.baseName}/${f.name}`
          });
        });
        results.push({
          originalName: result.originalName,
          fileCount: result.savedFiles.length,
          totalPages: result.totalPages,
          success: true
        });
      } catch (err) {
        console.error(`Error splitting ${file.originalname}:`, err);
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
      tempDirs.forEach(dir => fs.removeSync(dir));
      return res.status(500).json({ error: 'Failed to split any PDF files' });
    }

    if (successResults.length === 1 && successResults[0].fileCount === 1) {
      const singleFile = allSplitFiles[0];
      const destFileName = singleFile.name;
      const destPath = path.join(outputDir, destFileName);
      fs.moveSync(singleFile.path, destPath, { overwrite: true });
      tempDirs.forEach(dir => fs.removeSync(dir));

      const fileSize = fs.statSync(destPath).size;
      const historyRecord = addHistory({
        type: 'split',
        fileName: destFileName,
        originalName: `split_${successResults[0].originalName}`,
        fileSize,
        filePath: `output/${destFileName}`,
        downloadUrl: `/download/${destFileName}`,
        fileCount: 1
      });

      return res.json({
        success: true,
        isBatch: false,
        downloadUrl: `/download/${destFileName}`,
        fileName: destFileName,
        fileSize,
        fileCount: 1,
        files: [{ name: singleFile.name, size: singleFile.size }],
        historyId: historyRecord.id,
        results
      });
    }

    const zipName = `split_batch_${batchSessionId}.zip`;
    const zipPath = path.join(outputDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    allSplitFiles.forEach(file => {
      archive.file(file.path, { name: file.archiveName });
    });
    await archive.finalize();

    tempDirs.forEach(dir => fs.removeSync(dir));

    const fileSize = fs.statSync(zipPath).size;
    let totalFileCount = 0;
    successResults.forEach(r => {
      totalFileCount += r.fileCount;
    });

    const historyRecord = addHistory({
      type: 'split',
      fileName: zipName,
      originalName: `split_batch_${successResults.length}_pdfs.zip`,
      fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      fileCount: totalFileCount,
      pdfCount: successResults.length
    });

    res.json({
      success: true,
      isBatch: true,
      downloadUrl: `/download/${zipName}`,
      fileName: zipName,
      fileSize,
      fileCount: totalFileCount,
      pdfCount: successResults.length,
      files: allSplitFiles.map(f => ({ name: f.name, size: f.size })),
      historyId: historyRecord.id,
      results
    });
  } catch (error) {
    console.error('Split error:', error);
    res.status(500).json({ error: 'Failed to split PDF: ' + error.message });
  }
});

module.exports = router;
