const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Stats route must be before :id route to avoid treating 'stats' as an ID
router.get('/stats', auth, checkPermission('leads', 'read'), leadController.getStats);

// Standard CRUD routes
router.get('/', auth, checkPermission('leads', 'read'), leadController.getAll);
router.get('/:id', auth, checkPermission('leads', 'read'), leadController.getById);
router.post('/', auth, checkPermission('leads', 'create'), leadController.create);
router.put('/:id', auth, checkPermission('leads', 'update'), leadController.update);
router.delete('/:id', auth, checkPermission('leads', 'delete'), leadController.delete);

// Convert lead to contact/deal
router.post('/:id/convert', auth, checkPermission('leads', 'update'), leadController.convert);

module.exports = router;
