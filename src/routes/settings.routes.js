const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { paginationSchema } = require('../utils/validators');

router.get('/', auth, checkPermission('settings', 'read'), settingsController.getSettings);
router.put('/', auth, checkPermission('settings', 'update'), settingsController.updateSettings);

// Audit logs
router.get('/audit-logs', auth, checkPermission('settings', 'read'), validate(paginationSchema, 'query'), settingsController.getAuditLogs);

module.exports = router;
