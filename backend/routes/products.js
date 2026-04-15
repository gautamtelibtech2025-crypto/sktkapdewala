const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories } = require('../controllers/productController');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProduct);
router.post('/', authMiddleware, adminOnly, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), createProduct);
router.put('/:id', authMiddleware, adminOnly, updateProduct);
router.delete('/:id', authMiddleware, adminOnly, deleteProduct);

module.exports = router;
