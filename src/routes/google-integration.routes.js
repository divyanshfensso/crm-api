const express = require('express');
const router = express.Router();
const controller = require('../controllers/google-integration.controller');
const { auth } = require('../middleware/auth');

// GET /auth-url - Generate OAuth authorization URL
router.get('/auth-url', auth, controller.getAuthUrl);

// GET /callback - OAuth callback (no auth - user redirected from Google)
router.get('/callback', controller.handleCallback);

// DELETE /disconnect - Disconnect Google account
router.delete('/disconnect', auth, controller.disconnect);

// GET /status - Get connection status
router.get('/status', auth, controller.getStatus);

// GET /events - Pull Google Calendar events
router.get('/events', auth, controller.getGoogleEvents);

module.exports = router;
