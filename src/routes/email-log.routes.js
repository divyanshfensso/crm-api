const express = require('express');
const router = express.Router();
const emailLogController = require('../controllers/email-log.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET / - Get all email logs
router.get('/', auth, checkPermission('email_logs', 'read'), emailLogController.getAll);

// GET /:id - Get email log by ID
router.get('/:id', auth, checkPermission('email_logs', 'read'), emailLogController.getById);

module.exports = router;
