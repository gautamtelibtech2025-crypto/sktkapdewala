const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = file.mimetype.startsWith('video/') ? 'videos' : 'images';
    const dir = path.join(uploadDir, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImages = /jpeg|jpg|png|gif|webp/;
  const allowedVideos = /mp4|mov|avi|mkv/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  
  if (file.mimetype.startsWith('image/') && allowedImages.test(ext)) return cb(null, true);
  if (file.mimetype.startsWith('video/') && allowedVideos.test(ext)) return cb(null, true);
  cb(new Error('Invalid file type'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || 104857600
  }
});

module.exports = upload;
