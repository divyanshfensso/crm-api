const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET /stats - Must be before /:id to avoid matching "stats" as an ID
router.get('/stats', auth, checkPermission('contacts', 'read'), contactController.getStats);

// GET / - Get all contacts
router.get('/', auth, checkPermission('contacts', 'read'), contactController.getAll);

// GET /:id - Get contact by ID
router.get('/:id', auth, checkPermission('contacts', 'read'), contactController.getById);

// POST / - Create new contact
router.post('/', auth, checkPermission('contacts', 'create'), contactController.create);

// PUT /:id - Update contact
router.put('/:id', auth, checkPermission('contacts', 'update'), contactController.update);

// DELETE /:id - Delete contact
router.delete('/:id', auth, checkPermission('contacts', 'delete'), contactController.delete);

module.exports = router;
