const express = require('express');
const router = express.Router();

const {
  createWarehouse,
  updateWarehouse,
  deactivateWarehouse,
  getWarehouses,
  getWarehouse,
} = require('../controllers/warehouse.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { warehouseValidator, warehouseUpdateValidator } = require('../validators/warehouse.validator');

router.use(protect, authorize('admin')); // every warehouse endpoint is admin-only

router.get('/', getWarehouses);
router.get('/:id', getWarehouse);
router.post('/', warehouseValidator, validate, createWarehouse);
router.put('/:id', warehouseUpdateValidator, validate, updateWarehouse);
router.delete('/:id', deactivateWarehouse);

module.exports = router;
