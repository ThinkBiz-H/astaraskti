const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  registerPushToken,
  unregisterPushToken,
} = require('../controllers/notification.controller');

const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.post('/push-token', registerPushToken);
router.delete('/push-token', unregisterPushToken);
router.delete('/:id', deleteNotification);
router.delete('/', clearAllNotifications);

module.exports = router;
