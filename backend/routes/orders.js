const express = require('express');
const router = express.Router();
const { createOrder, getOrders, updateOrderStatus } = require('../controllers/orderController');
const { authMiddleware, adminOnly, optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, createOrder);
router.get('/', authMiddleware, getOrders);
router.put('/status', authMiddleware, adminOnly, updateOrderStatus);

module.exports = router;
