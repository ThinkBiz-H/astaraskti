const express = require('express');
const router = express.Router();

const {
  createContactEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiry,
  deleteEnquiry,
} = require('../controllers/contactEnquiry.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createContactEnquiryValidator } = require('../validators/contactEnquiry.validator');

// Public route - create enquiry
router.post(
  '/',
  createContactEnquiryValidator,
  validate,
  createContactEnquiry
);

// Admin routes
router.use(protect, authorize('admin'));

router.get('/', getAllEnquiries);
router.get('/:id', getEnquiryById);
router.patch('/:id', updateEnquiry);
router.delete('/:id', deleteEnquiry);

module.exports = router;
