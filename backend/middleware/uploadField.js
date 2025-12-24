const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directory for field media
const uploadDir = path.join(__dirname, '..', 'uploads', 'fields');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext).replace(/[^a-z0-9.-]/gi, '_');
    cb(null, `field-${uniqueSuffix}-${nameWithoutExt}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))) {
    cb(null, true);
  } else {
    cb(new Error('Only image/video files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Accept multiple files under field name 'images'
const uploadFieldMedia = upload.array('images', 8);

const handleUploadError = (req, res, next) => {
  uploadFieldMedia(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload error' });
    }
    next();
  });
};

module.exports = {
  uploadFieldMedia: handleUploadError,
  uploadDir,
};
