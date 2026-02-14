const microsoftService = require('../services/microsoft.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const microsoftIntegrationController = {
  /**
   * GET /api/integrations/microsoft/auth-url
   */
  getAuthUrl: asyncHandler(async (req, res) => {
    const { url } = await microsoftService.getAuthUrl(req.user.id);
    res.json(ApiResponse.success('Authorization URL generated', { url }));
  }),

  /**
   * GET /api/integrations/microsoft/callback
   * OAuth callback — exchanges code for tokens, redirects to frontend
   */
  handleCallback: asyncHandler(async (req, res) => {
    const { code, state, error: oauthError, error_description } = req.query;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (oauthError) {
      return res.redirect(
        `${clientUrl}/settings/profile?microsoft=error&reason=${encodeURIComponent(
          error_description || oauthError
        )}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${clientUrl}/settings/profile?microsoft=error&reason=missing_params`
      );
    }

    try {
      const { userId, userEmail } = await microsoftService.handleCallback(code, state);

      await createAuditLog(
        userId,
        'CREATE',
        'INTEGRATION',
        null,
        null,
        { provider: 'microsoft', email: userEmail },
        req
      );

      res.redirect(
        `${clientUrl}/settings/profile?microsoft=success&email=${encodeURIComponent(userEmail)}`
      );
    } catch (err) {
      console.error('Microsoft OAuth callback error:', err);
      res.redirect(
        `${clientUrl}/settings/profile?microsoft=error&reason=${encodeURIComponent(err.message)}`
      );
    }
  }),

  /**
   * DELETE /api/integrations/microsoft/disconnect
   */
  disconnect: asyncHandler(async (req, res) => {
    const result = await microsoftService.disconnect(req.user.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'INTEGRATION',
      null,
      null,
      { provider: 'microsoft' },
      req
    );

    res.json(ApiResponse.success('Microsoft account disconnected', result));
  }),

  /**
   * GET /api/integrations/microsoft/status
   */
  getStatus: asyncHandler(async (req, res) => {
    const status = await microsoftService.getStatus(req.user.id);
    res.json(ApiResponse.success('Microsoft integration status', status));
  }),

  /**
   * GET /api/integrations/microsoft/events
   */
  getOutlookEvents: asyncHandler(async (req, res) => {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) {
      return res.status(400).json(
        ApiResponse.error('date_from and date_to query params are required')
      );
    }
    const events = await microsoftService.pullOutlookEvents(req.user.id, date_from, date_to);
    res.json(ApiResponse.success('Outlook Calendar events retrieved', { events }));
  }),
};

module.exports = microsoftIntegrationController;
