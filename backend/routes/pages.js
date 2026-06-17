const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument, degrees } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

router.post('/delete', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { pagesToDelete } = req.body;
    if (!pagesToDelete) {
      return res.status(400).json({ error: 'Please specify pages to delete' });
    }

    const pagesToDeleteArr = pagesToDelete.split(',').map(p => parseInt(p.trim()) - 1);
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    const validPages = pagesToDeleteArr.filter(p => p >= 0 && p < totalPages);
    const pagesToKeep = [];
    
    for (let i = 0; i < totalPages; i++) {
      if (!validPages.includes(i)) {
        pagesToKeep.push(i);
      }
    }

    if (pagesToKeep.length === 0) {
      fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'Cannot delete all pages' });
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
    copiedPages.forEach(page => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    const outputFileName = `pages_deleted_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, newPdfBytes);

    fs.removeSync(req.file.path);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'pages-delete',
      fileName: outputFileName,
      originalName: `deleted_pages_${req.file.originalname}`,
      fileSize: fileSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`,
      pagesDeleted: validPages.length,
      pagesRemaining: pagesToKeep.length
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      fileSize: fileSize,
      pagesDeleted: validPages.length,
      pagesRemaining: pagesToKeep.length,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Delete pages error:', error);
    res.status(500).json({ error: 'Failed to delete pages: ' + error.message });
  }
});

router.post('/rotate', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { pagesToRotate, rotation } = req.body;
    if (!pagesToRotate || !rotation) {
      return res.status(400).json({ error: 'Please specify pages and rotation' });
    }

    const pagesToRotateArr = pagesToRotate === 'all' ? 'all' : 
      pagesToRotate.split(',').map(p => parseInt(p.trim()) - 1);
    const rotationNum = parseInt(rotation);

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = pdf.getPages();
    const totalPages = pages.length;

    pages.forEach((page, idx) => {
      const shouldRotate = pagesToRotateArr === 'all' || pagesToRotateArr.includes(idx);
      if (shouldRotate && idx >= 0 && idx < totalPages) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + rotationNum) % 360));
      }
    });

    const rotatedBytes = await pdf.save();
    const outputFileName = `rotated_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, rotatedBytes);

    fs.removeSync(req.file.path);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'pages-rotate',
      fileName: outputFileName,
      originalName: `rotated_${req.file.originalname}`,
      fileSize: fileSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`,
      rotation: rotationNum
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      fileSize: fileSize,
      rotation: rotationNum,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Rotate pages error:', error);
    res.status(500).json({ error: 'Failed to rotate pages: ' + error.message });
  }
});

router.post('/extract', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { pagesToExtract } = req.body;
    if (!pagesToExtract) {
      return res.status(400).json({ error: 'Please specify pages to extract' });
    }

    const pagesToExtractArr = pagesToExtract.split(',').map(p => parseInt(p.trim()) - 1);
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    const validPages = pagesToExtractArr.filter(p => p >= 0 && p < totalPages);
    
    if (validPages.length === 0) {
      fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'No valid pages to extract' });
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, validPages);
    copiedPages.forEach(page => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    const outputFileName = `extracted_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, newPdfBytes);

    fs.removeSync(req.file.path);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'pages-extract',
      fileName: outputFileName,
      originalName: `extracted_${req.file.originalname}`,
      fileSize: fileSize,
      filePath: `output/${outputFileName}`,
      downloadUrl: `/download/${outputFileName}`,
      pagesExtracted: validPages.length
    });

    res.json({
      success: true,
      downloadUrl: `/download/${outputFileName}`,
      fileName: outputFileName,
      fileSize: fileSize,
      pagesExtracted: validPages.length,
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('Extract pages error:', error);
    res.status(500).json({ error: 'Failed to extract pages: ' + error.message });
  }
});

router.post('/reorder', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { newOrder } = req.body;
    if (!newOrder) {
      return res.status(400).json({ error: 'Please specify new page order' });
    }

    const newOrderArr = JSON.parse(newOrder).map(p => parseInt(p) - 1);
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    const validOrder = newOrderArr.filter(p => p >= 0 && p < totalPages);
    
    if (validOrder.length !== totalPages) {
      fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'Invalid page order' });
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, validOrder);
    copiedPages.forEach(page => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    const outputFileName = `reordered_${uuidv4()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, newPdfBytes);

    fs.removeSync(req.file.path);

    const fileSize = fs.statSync(outputPath).size;
    const historyRecord = addHistory({
      type: 'pages-reorder',
      fileName: outputFileName,
      originalName: `reordered_${req.file.originalname}`,
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
    console.error('Reorder pages error:', error);
    res.status(500).json({ error: 'Failed to reorder pages: ' + error.message });
  }
});

module.exports = router;
