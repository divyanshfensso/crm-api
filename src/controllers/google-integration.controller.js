const googleService = require('../services/google.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const googleIntegrationController = {
  /**
   * GET /api/integrations/google/auth-url
   * Returns the Google OAuth authorization URL
   */
  getAuthUrl: asyncHandler(async (req, res) => {
    const { url } = await googleService.getAuthUrl(req.user.id);
    res.json(ApiResponse.success('Authorization URL generated', { url }));
  }),

  /**
   * GET /api/integrations/google/callback
   * OAuth callback — exchanges code for tokens, redirects to frontend
   */
  handleCallback: asyncHandler(async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (oauthError) {
      return res.redirect(
        `${clientUrl}/settings/profile?google=error&reason=${encodeURIComponent(oauthError)}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${clientUrl}/settings/profile?google=error&reason=missing_params`
      );
    }

    try {
      const { userId, userEmail } = await googleService.handleCallback(code, state);

      await createAuditLog(
        userId,
        'CREATE',
        'INTEGRATION',
        null,
        null,
        { provider: 'google', email: userEmail },
        req
      );

      res.redirect(
        `${clientUrl}/settings/profile?google=success&email=${encodeURIComponent(userEmail)}`
      );
    } catch (err) {
      console.error('Google OAuth callback error:', err);
      res.redirect(
        `${clientUrl}/settings/profile?google=error&reason=${encodeURIComponent(err.message)}`
      );
    }
  }),

  /**
   * DELETE /api/integrations/google/disconnect
   */
  disconnect: asyncHandler(async (req, res) => {
    const result = await googleService.disconnect(req.user.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'INTEGRATION',
      null,
      null,
      { provider: 'google' },
      req
    );

    res.json(ApiResponse.success('Google account disconnected', result));
  }),

  /**
   * GET /api/integrations/google/status
   */
  getStatus: asyncHandler(async (req, res) => {
    const status = await googleService.getStatus(req.user.id);
    res.json(ApiResponse.success('Google integration status', status));
  }),

  /**
   * GET /api/integrations/google/events
   * Pull Google Calendar events for display
   */
  getGoogleEvents: asyncHandler(async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) {
      return res.status(400).json(
        ApiResponse.error('date_from and date_to query params are required')
      );
    }
    const events = await googleService.pullGoogleEvents(req.user.id, date_from, date_to);
    res.json(ApiResponse.success('Google Calendar events retrieved', { events }));
  }),
};

module.exports = googleIntegrationController;
