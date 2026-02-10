const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET / - Get all webhooks
router.get('/', auth, checkPermission('webhooks', 'read'), webhookController.getAll);

// POST / - Create new webhook
router.post('/', auth, checkPermission('webhooks', 'create'), webhookController.create);

// Static routes BEFORE /:id
// POST /deliveries/:deliveryId/retry - Retry a failed delivery
router.post('/deliveries/:deliveryId/retry', auth, checkPermission('webhooks', 'update'), webhookController.retryDelivery);

// GET /:id - Get webhook by ID
router.get('/:id', auth, checkPermission('webhooks', 'read'), webhookController.getById);

// PUT /:id - Update webhook
router.put('/:id', auth, checkPermission('webhooks', 'update'), webhookController.update);

// DELETE /:id - Delete webhook
router.delete('/:id', auth, checkPermission('webhooks', 'delete'), webhookController.delete);

// GET /:id/deliveries - Get deliveries for a webhook
router.get('/:id/deliveries', auth, checkPermission('webhooks', 'read'), webhookController.getDeliveries);

// POST /:id/test - Send test delivery
router.post('/:id/test', auth, checkPermission('webhooks', 'update'), webhookController.test);

module.exports = router;
