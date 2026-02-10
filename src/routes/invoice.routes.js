const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Static routes must be before :id route to avoid treating them as IDs
router.get('/stats', auth, checkPermission('invoices', 'read'), invoiceController.getStats);

// Standard CRUD routes
router.get('/', auth, checkPermission('invoices', 'read'), invoiceController.getAll);
router.get('/:id', auth, checkPermission('invoices', 'read'), invoiceController.getById);
router.post('/', auth, checkPermission('invoices', 'create'), invoiceController.create);
router.put('/:id', auth, checkPermission('invoices', 'update'), invoiceController.update);
router.delete('/:id', auth, checkPermission('invoices', 'delete'), invoiceController.delete);

module.exports = router;
