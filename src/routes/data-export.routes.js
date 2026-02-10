const express = require('express');
const router = express.Router();
const dataExportController = require('../controllers/data-export.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// POST / - Create new data export request
router.post('/', auth, checkPermission('data_exports', 'create'), dataExportController.create);

// GET / - Get all data exports for current user
router.get('/', auth, checkPermission('data_exports', 'read'), dataExportController.getAll);

// GET /:id/download - Download export file (before /:id to avoid conflict)
router.get('/:id/download', auth, checkPermission('data_exports', 'read'), dataExportController.download);

// GET /:id - Get data export by ID
router.get('/:id', auth, checkPermission('data_exports', 'read'), dataExportController.getById);

// DELETE /:id - Delete data export
router.delete('/:id', auth, checkPermission('data_exports', 'read'), dataExportController.delete);

module.exports = router;
