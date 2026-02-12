const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const upload = require('../middleware/upload');

// GET / - Get all documents
router.get('/', auth, checkPermission('documents', 'read'), documentController.getAll);

// GET /folders - Get distinct folder names (static route before :id)
router.get('/folders', auth, checkPermission('documents', 'read'), documentController.getFolders);

// GET /:id/download - Download document (must be before /:id to avoid matching)
router.get('/:id/download', auth, checkPermission('documents', 'read'), documentController.download);

// GET /:id - Get document by ID
router.get('/:id', auth, checkPermission('documents', 'read'), documentController.getById);

// PUT /:id/folder - Move document to folder
router.put('/:id/folder', auth, checkPermission('documents', 'create'), documentController.updateFolder);

// POST / - Upload new document
router.post('/', auth, checkPermission('documents', 'create'), upload.single('file'), documentController.create);

// DELETE /:id - Delete document
router.delete('/:id', auth, checkPermission('documents', 'delete'), documentController.delete);

module.exports = router;
