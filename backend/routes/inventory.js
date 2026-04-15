const express = require('express');
const router = express.Router();
const { getInventory, setInventory, getStores } = require('../controllers/inventoryController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/', getInventory);
router.post('/', authMiddleware, adminOnly, setInventory);
router.get('/stores', getStores);

module.exports = router;
