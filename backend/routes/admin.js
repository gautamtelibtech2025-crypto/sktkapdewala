const express = require('express');
const router = express.Router();
const { getDashboard, getUsers, getStores, createStore, getSettings, updateSettings } = require('../controllers/adminController');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authMiddleware, adminOnly);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/stores', getStores);
router.post('/stores', createStore);
router.get('/settings', getSettings);
router.post('/settings', updateSettings);
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const isVideo = req.file.mimetype.startsWith('video/');
  const url = `/uploads/${isVideo ? 'videos' : 'images'}/${req.file.filename}`;
  res.json({ success: true, data: { url, filename: req.file.filename } });
});

module.exports = router;
