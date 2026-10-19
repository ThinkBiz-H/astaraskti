const express = require('express');
const router = express.Router();

const {
  purchaseStock,
  adjustStock,
  markDamaged,
  transferStock,
  reserveStock,
  releaseReservedStock,
  getStockByProduct,
  getLowStock,
  getInventorySummary,
  getMovements,
} = require('../controllers/inventory.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  purchaseValidator,
  adjustValidator,
  transferValidator,
  reserveValidator,
} = require('../validators/inventory.validator');

router.use(protect, authorize('admin')); // every inventory endpoint is admin-only

router.get('/low-stock', getLowStock);
router.get('/summary', getInventorySummary);
router.get('/movements', getMovements);
router.get('/stock/:productId', getStockByProduct);

router.post('/purchase', purchaseValidator, validate, purchaseStock);
router.post('/adjust', adjustValidator, validate, adjustStock);
router.post('/damaged', purchaseValidator, validate, markDamaged);
router.post('/transfer', transferValidator, validate, transferStock);
router.post('/reserve', reserveValidator, validate, reserveStock);
router.post('/release', reserveValidator, validate, releaseReservedStock);

module.exports = router;
