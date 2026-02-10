const express = require('express');
const router = express.Router();
const dealController = require('../controllers/deal.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Stats and pipeline routes must be before :id route to avoid treating them as IDs
router.get('/stats', auth, checkPermission('deals', 'read'), dealController.getStats);
router.get('/pipeline', auth, checkPermission('deals', 'read'), dealController.getByPipeline);
router.get('/pipeline/:pipelineId', auth, checkPermission('deals', 'read'), dealController.getByPipeline);

// Standard CRUD routes
router.get('/', auth, checkPermission('deals', 'read'), dealController.getAll);
router.get('/:id', auth, checkPermission('deals', 'read'), dealController.getById);
router.post('/', auth, checkPermission('deals', 'create'), dealController.create);
router.put('/:id/stage', auth, checkPermission('deals', 'update'), dealController.updateStage);
router.put('/:id', auth, checkPermission('deals', 'update'), dealController.update);
router.delete('/:id', auth, checkPermission('deals', 'delete'), dealController.delete);

module.exports = router;
