const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const upload = require('../middleware/upload');

// GET /template/:entityType - Download CSV template (static route before /:id)
router.get('/template/:entityType', auth, checkPermission('imports', 'read'), importController.getTemplate);

// POST /upload - Upload CSV file for import (static route before /:id)
router.post('/upload', auth, checkPermission('imports', 'create'), upload.single('file'), importController.upload);

// GET / - Get all import jobs
router.get('/', auth, checkPermission('imports', 'read'), importController.getAll);

// GET /:id - Get import job by ID
router.get('/:id', auth, checkPermission('imports', 'read'), importController.getById);

// GET /:id/preview - Preview import file rows
router.get('/:id/preview', auth, checkPermission('imports', 'read'), importController.preview);

// PUT /:id/entity-type - Update entity type after AI detection
router.put('/:id/entity-type', auth, checkPermission('imports', 'create'), importController.updateEntityType);

// POST /:id/mapping - Save column mapping
router.post('/:id/mapping', auth, checkPermission('imports', 'create'), importController.mapColumns);

// POST /:id/validate - Validate import data before processing
router.post('/:id/validate', auth, checkPermission('imports', 'create'), importController.validate);

// POST /:id/process - Process import job
router.post('/:id/process', auth, checkPermission('imports', 'create'), importController.process);

module.exports = router;
