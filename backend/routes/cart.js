const express = require('express');
const router = express.Router();
const { getCart, addToCart, removeFromCart, updateCartItem } = require('../controllers/cartController');
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);
router.get('/', getCart);
router.post('/add', addToCart);
router.delete('/remove', removeFromCart);
router.put('/update', updateCartItem);

module.exports = router;
