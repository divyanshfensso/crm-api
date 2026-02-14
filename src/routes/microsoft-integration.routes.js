const express = require('express');
const router = express.Router();
const controller = require('../controllers/microsoft-integration.controller');
const { auth } = require('../middleware/auth');

// GET /auth-url - Generate Microsoft OAuth authorization URL
router.get('/auth-url', auth, controller.getAuthUrl);

// GET /callback - OAuth callback (no auth - user redirected from Microsoft)
router.get('/callback', controller.handleCallback);

// DELETE /disconnect - Disconnect Microsoft account
router.delete('/disconnect', auth, controller.disconnect);

// GET /status - Get connection status
router.get('/status', auth, controller.getStatus);

// GET /events - Pull Outlook Calendar events
router.get('/events', auth, controller.getOutlookEvents);

module.exports = router;
