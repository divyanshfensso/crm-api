const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const workflowController = require('../controllers/workflow.controller');

// POST /suggest-steps — AI suggest workflow steps (static route BEFORE :id)
router.post('/suggest-steps', auth, checkPermission('workflows', 'create'), workflowController.suggestSteps);

// GET / - Get all workflows
router.get('/', auth, checkPermission('workflows', 'read'), workflowController.getAll);

// POST / - Create new workflow
router.post('/', auth, checkPermission('workflows', 'create'), workflowController.create);

// GET /:id - Get workflow by ID
router.get('/:id', auth, checkPermission('workflows', 'read'), workflowController.getById);

// PUT /:id - Update workflow
router.put('/:id', auth, checkPermission('workflows', 'update'), workflowController.update);

// DELETE /:id - Delete workflow
router.delete('/:id', auth, checkPermission('workflows', 'delete'), workflowController.delete);

// POST /:id/execute - Execute workflow
router.post('/:id/execute', auth, checkPermission('workflows', 'update'), workflowController.execute);

// POST /:id/test - Test (dry run) workflow
router.post('/:id/test', auth, checkPermission('workflows', 'read'), workflowController.test);

// GET /:id/logs - Get workflow execution logs
router.get('/:id/logs', auth, checkPermission('workflows', 'read'), workflowController.getLogs);

module.exports = router;
