const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const uploadsDir = path.join(__dirname, '../uploads');
fs.ensureDirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    pdf: ['application/pdf'],
    image: ['image/jpeg', 'image/png', 'image/jpg']
  };
  
  const fieldName = file.fieldname;
  let allowedMimeTypes = [];
  
  if (fieldName === 'pdf' || fieldName === 'files') {
    allowedMimeTypes = allowedTypes.pdf;
  } else if (fieldName === 'images' || fieldName === 'watermarkImage') {
    allowedMimeTypes = allowedTypes.image;
  } else {
    allowedMimeTypes = [...allowedTypes.pdf, ...allowedTypes.image];
  }
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

module.exports = upload;
