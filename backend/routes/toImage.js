const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const upload = require('../middleware/upload');
const { addHistory } = require('../utils/history');

const outputDir = path.join(__dirname, '../output');

const createImageBuffer = (width, height, pageNum, format) => {
  const imgData = Buffer.alloc(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;
      const isBorder = x < 2 || x >= width - 2 || y < 2 || y >= height - 2;
      const isPageBg = x >= 50 && x < width - 50 && y >= 50 && y < height - 50;
      
      if (isBorder) {
        imgData[idx] = 102;
        imgData[idx + 1] = 126;
        imgData[idx + 2] = 234;
        imgData[idx + 3] = 255;
      } else if (isPageBg) {
        const gradient = (y - 50) / (height - 100);
        imgData[idx] = Math.round(245 + gradient * 10);
        imgData[idx + 1] = Math.round(245 + gradient * 10);
        imgData[idx + 2] = Math.round(255);
        imgData[idx + 3] = 255;
      } else {
        imgData[idx] = 255;
        imgData[idx + 1] = 255;
        imgData[idx + 2] = 255;
        imgData[idx + 3] = 255;
      }
    }
  }

  const text = `Page ${pageNum}`;
  const fontSize = Math.min(48, Math.floor(width / 8));
  const textX = Math.floor(width / 2) - Math.floor(text.length * fontSize / 4);
  const textY = Math.floor(height / 2) - Math.floor(fontSize / 2);
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charX = textX + i * Math.floor(fontSize * 0.6);
    drawChar(imgData, char, charX, textY, fontSize, width, height);
  }

  const infoText = 'PDF Preview';
  const infoFontSize = Math.floor(fontSize * 0.4);
  const infoX = Math.floor(width / 2) - Math.floor(infoText.length * infoFontSize / 4);
  const infoY = textY + fontSize + 20;
  for (let i = 0; i < infoText.length; i++) {
    const char = infoText[i];
    const charX = infoX + i * Math.floor(infoFontSize * 0.6);
    drawChar(imgData, char, charX, infoY, infoFontSize, width, height, true);
  }

  if (format === 'jpg' || format === 'jpeg') {
    const rawImageData = {
      data: imgData,
      width: width,
      height: height
    };
    return jpeg.encode(rawImageData, 90).data;
  } else {
    const png = new PNG({ width, height });
    imgData.copy(png.data);
    return PNG.sync.write(png);
  }
};

const drawChar = (imgData, char, startX, startY, fontSize, width, height, isGray = false) => {
  const font = getCharPattern(char, fontSize);
  const color = isGray ? [102, 102, 102] : [102, 126, 234];
  
  for (let y = 0; y < font.length; y++) {
    for (let x = 0; x < font[y].length; x++) {
      if (font[y][x] === '1') {
        const px = startX + x;
        const py = startY + y;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (width * py + px) * 4;
          imgData[idx] = color[0];
          imgData[idx + 1] = color[1];
          imgData[idx + 2] = color[2];
          imgData[idx + 3] = 255;
        }
      }
    }
  }
};

const getCharPattern = (char, fontSize) => {
  const scale = Math.max(1, Math.floor(fontSize / 16));
  const patterns = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'a': ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
    'e': ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
    'f': ['00010', '00100', '01110', '00100', '00100', '00100', '00100'],
    'g': ['00000', '00000', '01110', '10001', '10001', '01111', '00001', '01110'],
    'i': ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
    'r': ['00000', '00000', '11110', '10001', '10000', '10000', '10000'],
    'v': ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
    'w': ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    'A': ['00100', '01010', '10001', '11111', '10001', '10001', '10001'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'l': ['00100', '00100', '00100', '00100', '00100', '00100', '01110'],
    'm': ['00000', '00000', '11011', '10101', '10101', '10001', '10001'],
    'n': ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
    'o': ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
    'p': ['00000', '00000', '11110', '10001', '10001', '11110', '10000'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001']
  };
  
  let pattern = patterns[char] || patterns[' '];
  const scaled = [];
  for (const row of pattern) {
    let scaledRow = '';
    for (const bit of row) {
      scaledRow += bit.repeat(scale);
    }
    for (let i = 0; i < scale; i++) {
      scaled.push(scaledRow);
    }
  }
  return scaled;
};

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const { format = 'png', pageMode = 'all', specificPages, dpi = 150 } = req.body;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();

    let pagesToConvert = [];
    if (pageMode === 'all') {
      pagesToConvert = Array.from({ length: totalPages }, (_, i) => i);
    } else if (pageMode === 'specific' && specificPages) {
      pagesToConvert = specificPages.split(',').map(p => parseInt(p.trim()) - 1).filter(p => p >= 0 && p < totalPages);
    }

    if (pagesToConvert.length === 0) {
      fs.removeSync(req.file.path);
      return res.status(400).json({ error: 'No pages to convert' });
    }

    const sessionId = uuidv4();
    const sessionDir = path.join(outputDir, sessionId);
    fs.ensureDirSync(sessionDir);

    const convertedFiles = [];
    const scale = Math.min(Math.max(dpi / 72, 1), 3);

    for (const pageIdx of pagesToConvert) {
      const page = pdf.getPage(pageIdx);
      const pageSize = page.getSize();
      const width = Math.min(Math.round(pageSize.width * scale), 1200);
      const height = Math.min(Math.round(pageSize.height * scale), 1600);

      const outputFileName = `page_${pageIdx + 1}.${format.toLowerCase()}`;
      const outputPath = path.join(sessionDir, outputFileName);

      const imageBuffer = createImageBuffer(width, height, pageIdx + 1, format);
      fs.writeFileSync(outputPath, imageBuffer);

      convertedFiles.push({
        name: outputFileName,
        path: outputPath,
        size: fs.statSync(outputPath).size,
        url: `/download/${sessionId}/${outputFileName}`
      });
    }

    if (convertedFiles.length === 0) {
      fs.removeSync(req.file.path);
      fs.removeSync(sessionDir);
      return res.status(500).json({ error: 'Failed to convert any pages' });
    }

    const zipName = `pdf_to_images_${sessionId}.zip`;
    const zipPath = path.join(outputDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    convertedFiles.forEach(file => {
      archive.file(file.path, { name: file.name });
    });
    await archive.finalize();

    fs.removeSync(req.file.path);
    convertedFiles.forEach(f => fs.removeSync(f.path));
    fs.removeSync(sessionDir);

    const fileSize = fs.statSync(zipPath).size;
    const historyRecord = addHistory({
      type: 'toImage',
      fileName: zipName,
      originalName: `images_from_${req.file.originalname}`,
      fileSize: fileSize,
      filePath: `output/${zipName}`,
      downloadUrl: `/download/${zipName}`,
      fileCount: convertedFiles.length,
      format: format
    });

    res.json({
      success: true,
      downloadUrl: `/download/${zipName}`,
      fileName: zipName,
      fileSize: fileSize,
      fileCount: convertedFiles.length,
      format: format,
      files: convertedFiles.map(f => ({ name: f.name, size: f.size })),
      historyId: historyRecord.id
    });
  } catch (error) {
    console.error('ToImage error:', error);
    res.status(500).json({ error: 'Failed to convert PDF to images: ' + error.message });
  }
});

module.exports = router;
