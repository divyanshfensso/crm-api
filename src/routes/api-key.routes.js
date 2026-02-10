const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/api-key.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET / - Get all API keys
router.get('/', auth, checkPermission('api_keys', 'read'), apiKeyController.getAll);

// POST / - Generate new API key
router.post('/', auth, checkPermission('api_keys', 'create'), apiKeyController.generate);

// GET /:id - Get API key by ID
router.get('/:id', auth, checkPermission('api_keys', 'read'), apiKeyController.getById);

// POST /:id/revoke - Revoke an API key
router.post('/:id/revoke', auth, checkPermission('api_keys', 'delete'), apiKeyController.revoke);

// DELETE /:id - Delete an API key
router.delete('/:id', auth, checkPermission('api_keys', 'delete'), apiKeyController.delete);

// GET /:id/logs - Get API key logs
router.get('/:id/logs', auth, checkPermission('api_keys', 'read'), apiKeyController.getLogs);

module.exports = router;
