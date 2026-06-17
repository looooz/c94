const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const mergeRouter = require('./routes/merge');
const splitRouter = require('./routes/split');
const compressRouter = require('./routes/compress');
const toImageRouter = require('./routes/toImage');
const fromImageRouter = require('./routes/fromImage');
const watermarkRouter = require('./routes/watermark');
const pagesRouter = require('./routes/pages');
const historyRouter = require('./routes/history');

const app = express();
const PORT = 5094;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
const historyDir = path.join(__dirname, 'history');

fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(outputDir);
fs.ensureDirSync(historyDir);

app.use('/api/merge', mergeRouter);
app.use('/api/split', splitRouter);
app.use('/api/compress', compressRouter);
app.use('/api/to-image', toImageRouter);
app.use('/api/from-image', fromImageRouter);
app.use('/api/watermark', watermarkRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/history', historyRouter);

app.use('/download', express.static(outputDir));
app.use('/history-files', express.static(historyDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PDF Tool Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
