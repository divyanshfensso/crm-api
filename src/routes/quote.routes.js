const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quote.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Static routes must be before :id route to avoid treating them as IDs
router.get('/stats', auth, checkPermission('quotes', 'read'), quoteController.getStats);

// Standard CRUD routes
router.get('/', auth, checkPermission('quotes', 'read'), quoteController.getAll);
router.get('/:id', auth, checkPermission('quotes', 'read'), quoteController.getById);
router.post('/', auth, checkPermission('quotes', 'create'), quoteController.create);
router.put('/:id', auth, checkPermission('quotes', 'update'), quoteController.update);
router.post('/:id/convert', auth, checkPermission('invoices', 'create'), quoteController.convertToInvoice);
router.delete('/:id', auth, checkPermission('quotes', 'delete'), quoteController.delete);

module.exports = router;
