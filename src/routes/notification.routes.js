const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

router.use(auth);

// Static routes BEFORE parameterized
router.get('/unread-count', checkPermission('notifications', 'read'), notificationController.getUnreadCount);
router.put('/mark-all-read', checkPermission('notifications', 'update'), notificationController.markAllAsRead);
router.delete('/delete-read', checkPermission('notifications', 'delete'), notificationController.deleteRead);

// Standard routes
router.get('/', checkPermission('notifications', 'read'), notificationController.getAll);
router.get('/:id', checkPermission('notifications', 'read'), notificationController.getById);
router.put('/:id/read', checkPermission('notifications', 'update'), notificationController.markAsRead);
router.delete('/:id', checkPermission('notifications', 'delete'), notificationController.delete);

module.exports = router;
