const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Standard CRUD routes
router.get('/', auth, checkPermission('payments', 'read'), paymentController.getAll);
router.get('/:id', auth, checkPermission('payments', 'read'), paymentController.getById);
router.post('/', auth, checkPermission('payments', 'create'), paymentController.create);
router.put('/:id', auth, checkPermission('payments', 'update'), paymentController.update);
router.delete('/:id', auth, checkPermission('payments', 'delete'), paymentController.delete);

module.exports = router;
