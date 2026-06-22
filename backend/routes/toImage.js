const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');
const { createCanvas } = require('canvas');

const outputDir = path.join(__dirname, '../output');

let pdfjsLib = null;
let NodeCanvasFactory = null;

const initPdfJs = async () => {
  if (pdfjsLib) return;

  const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib = pdfjsModule;

  NodeCanvasFactory = (() => {
    class Factory {
      create(width, height) {
        if (width <= 0 || height <= 0) {
          throw new Error('Invalid canvas size');
        }
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return { canvas, context };
      }

      reset(canvasAndContext, width, height) {
        if (width <= 0 || height <= 0) {
          throw new Error('Invalid canvas size');
        }
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      }

      destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
      }
    }
    return new Factory();
  })();
};

const renderPDFPageToImage = async (pdfData, pageIndex, options = {}) => {
  await initPdfJs();

  const { format = 'png', dpi = 150 } = options;
  const scale = Math.min(Math.max(dpi / 72, 1), 4);

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfData),
    disableFontFace: false,
    useSystemFonts: true,
    canvasFactory: NodeCanvasFactory,
  });

  const pdfDocument = await loadingTask.promise;
  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  const canvasAndContext = NodeCanvasFactory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );

  const renderContext = {
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory: NodeCanvasFactory,
  };

  await page.render(renderContext).promise;

  let imageBuffer;
  const finalFormat = format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg' ? 'jpg' : 'png';

  if (finalFormat === 'jpg') {
    imageBuffer = canvasAndContext.canvas.toBuffer('image/jpeg', { quality: 0.92 });
  } else {
    imageBuffer = canvasAndContext.canvas.toBuffer('image/png');
  }

  NodeCanvasFactory.destroy(canvasAndContext);

  return {
    buffer: imageBuffer,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
    format: finalFormat,
  };
};

const convertSinglePDFToImages = async (file, options) => {
  const { format = 'png', pageMode = 'all', specificPages, dpi = 150 } = options;
  const pdfBytes = fs.readFileSync(file.path);
  const pdf = await PDFDocument.load(pdfBytes);
  const totalPages = pdf.getPageCount();

  let pagesToConvert = [];
  if (pageMode === 'all') {
    pagesToConvert = Array.from({ length: totalPages }, (_, i) => i);
  } else if (pageMode === 'specific' && specificPages) {
    const pageSpecs = specificPages.split(',').map((s) => s.trim()).filter(Boolean);
    for (const spec of pageSpecs) {
      if (spec.includes('-')) {
        const [start, end] = spec.split('-').map((n) => parseInt(n) - 1);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.max(0, start); p <= Math.min(totalPages - 1, end); p++) {
            pagesToConvert.push(p);
          }
        }
      } else {
        const p = parseInt(spec) - 1;
        if (!isNaN(p) && p >= 0 && p < totalPages) {
          pagesToConvert.push(p);
        }
      }
    }
    pagesToConvert = [...new Set(pagesToConvert)].sort((a, b) => a - b);
  }

  if (pagesToConvert.length === 0) {
    throw new Error('No pages to convert');
  }

  const baseName = path.basename(file.originalname, path.extname(file.originalname));
  const sessionId = uuidv4();
  const sessionDir = path.join(outputDir, sessionId);
  fs.ensureDirSync(sessionDir);

  const convertedFiles = [];
  const finalFormat = format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg' ? 'jpg' : 'png';

  for (const pageIdx of pagesToConvert) {
    const outputFileName = `${baseName}_page_${pageIdx + 1}.${finalFormat}`;
    const outputPath = path.join(sessionDir, outputFileName);

    const renderResult = await renderPDFPageToImage(pdfBytes, pageIdx, { format, dpi });
    fs.writeFileSync(outputPath, renderResult.buffer);

    convertedFiles.push({
      name: outputFileName,
      path: outputPath,
      size: fs.statSync(outputPath).size,
    });
  }

  return {
    originalName: file.originalname,
    baseName,
    sessionId,
    sessionDir,
    convertedFiles,
    format: finalFormat,
    totalPages,
  };
};

router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one PDF file' });
    }

    const { format = 'png', pageMode = 'all', specificPages, dpi = 150 } = req.body;
    const files = req.files;
    const options = { format, pageMode, specificPages, dpi };

    const batchSessionId = uuidv4();
    const allConvertedFiles = [];
    const results = [];
    const tempDirs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await convertSinglePDFToImages(file, options);
        tempDirs.push(result.sessionDir);
        result.convertedFiles.forEach((f) => {
          allConvertedFiles.push({
            ...f,
            archiveName: `${result.baseName}/${f.name}`,
          });
        });
        results.push({
          originalName: result.originalName,
          fileCount: result.convertedFiles.length,
          totalPages: result.totalPages,
          success: true,
        });
      } catch (err) {
        console.error(`Error converting ${file.originalname}:`, err);
        results.push({
          originalName: file.originalname,
          success: false,
          error: err.message,
        });
      } finally {
        if (fs.existsSync(file.path)) {
          fs.removeSync(file.path);
        }
      }
    }

    const successResults = results.filter((r) => r.success);
    if (successResults.length === 0) {
      tempDirs.forEach((dir) => fs.removeSync(dir));
      return res.status(500).json({ error: 'Failed to convert any PDF files' });
    }

    const isSinglePDFSingleImage = successResults.length === 1 && successResults[0].fileCount === 1;
    const finalFormat = format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg' ? 'jpg' : 'png';

    if (isSinglePDFSingleImage) {
      const singleFile = allConvertedFiles[0];
      const destFileName = `pdf_to_image_${uuidv4()}.${finalFormat}`;
      const destPath = path.join(outputDir, destFileName);
      fs.moveSync(singleFile.path, destPath, { overwrite: true });
      tempDirs.forEach((dir) => fs.removeSync(dir));

      const fileSize = fs.statSync(destPath).size;
      const historyRecord = addHistory({
        type: 'toImage',
        fileName: destFileName,
        originalName: `image_from_${successResults[0].originalName}`,
        fileSize,
        filePath: `output/${destFileName}`,
        downloadUrl: `/download/${destFileName}`,
        fileCount: 1,
        format: finalFormat,
      });

      return res.json({
        success: true,
        isBatch: false,
        downloadUrl: `/download/${destFileName}`,
        fileName: destFileName,
        fileSize,
        fileCount: 1,
        format: finalFormat,
        historyId: historyRecord.id,
        results,
      });
    }

    const zipName = `pdf_to_images_${batchSessionId}.zip`;
    const zipPath = path.join(outputDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    allConvertedFiles.forEach((file) => {
      archive.file(file.path, { name: file.archiveName });
    });
    await archive.finalize();

    tempDirs.forEach((dir) => fs.removeSync(dir));

    const fileSize = fs.statSync(zipPath).size;
    let totalFileCount = 0;
    successResults.forEach((r) => {
      totalFileCount += r.fileCount;
    });

    const historyRecord = addHistory({
      type: 'toImage',
      fileName: zipName,
      originalName: `images_from_${successResults.length}_pdfs.zip`,
      fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      fileCount: totalFileCount,
      format: finalFormat,
      pdfCount: successResults.length,
    });

    res.json({
      success: true,
      isBatch: true,
      downloadUrl: `/download/${zipName}`,
      fileName: zipName,
      fileSize,
      fileCount: totalFileCount,
      pdfCount: successResults.length,
      format: finalFormat,
      historyId: historyRecord.id,
      results,
    });
  } catch (error) {
    console.error('ToImage error:', error);
    res.status(500).json({ error: 'Failed to convert PDF to images: ' + error.message });
  }
});

module.exports = router;
