const express = require('express');
const router = express.Router();

const {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncementStatus,
  deleteAnnouncement,
} = require('../controllers/announcementBar.controller');

const { protect, authorize, optionalAuth } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { announcementValidator } = require('../validators/announcementBar.validator');

router.get('/', optionalAuth, getAnnouncements);

router.post('/', protect, authorize('admin'), announcementValidator, validate, createAnnouncement);
router.put('/:id', protect, authorize('admin'), announcementValidator, validate, updateAnnouncement);
router.patch('/:id/status', protect, authorize('admin'), toggleAnnouncementStatus);
router.delete('/:id', protect, authorize('admin'), deleteAnnouncement);

module.exports = router;
