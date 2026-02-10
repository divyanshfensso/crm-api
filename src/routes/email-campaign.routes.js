const express = require('express');
const router = express.Router();
const emailCampaignController = require('../controllers/email-campaign.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET /stats - Global campaign stats (static route before /:id)
router.get('/stats', auth, checkPermission('email_campaigns', 'read'), emailCampaignController.getStats);

// GET / - Get all email campaigns
router.get('/', auth, checkPermission('email_campaigns', 'read'), emailCampaignController.getAll);

// POST / - Create new email campaign
router.post('/', auth, checkPermission('email_campaigns', 'create'), emailCampaignController.create);

// GET /:id - Get email campaign by ID
router.get('/:id', auth, checkPermission('email_campaigns', 'read'), emailCampaignController.getById);

// PUT /:id - Update email campaign
router.put('/:id', auth, checkPermission('email_campaigns', 'update'), emailCampaignController.update);

// DELETE /:id - Delete email campaign
router.delete('/:id', auth, checkPermission('email_campaigns', 'delete'), emailCampaignController.delete);

// POST /:id/audience - Build campaign audience
router.post('/:id/audience', auth, checkPermission('email_campaigns', 'update'), emailCampaignController.buildAudience);

// POST /:id/send - Send campaign
router.post('/:id/send', auth, checkPermission('email_campaigns', 'update'), emailCampaignController.send);

// POST /:id/schedule - Schedule campaign
router.post('/:id/schedule', auth, checkPermission('email_campaigns', 'update'), emailCampaignController.schedule);

// GET /:id/stats - Get campaign statistics
router.get('/:id/stats', auth, checkPermission('email_campaigns', 'read'), emailCampaignController.getStats);

module.exports = router;
