const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/posts exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'posts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `post-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return cb(null, true);
  cb(new Error('Only images and videos are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
  fileFilter
});

// Accept up to 5 files under field name 'media' (frontend can use 'media' or 'images')
module.exports = {
  uploadPostMedia: upload.array('media', 5),
  uploadPostImages: upload.array('images', 5),
  uploadDir
};
