const ssoService = require('../services/sso.service');
const ApiResponse = require('../utils/apiResponse');

const ssoController = {
  /**
   * POST /api/auth/sso/nucleus
   * Verify Nucleus SSO token and login/create CRM user.
   */
  nucleusSsoLogin: async (req, res, next) => {
    try {
      const { ssoToken } = req.body;

      if (!ssoToken) {
        return res.status(400).json(ApiResponse.error('SSO token is required'));
      }

      // Verify the SSO token from Nucleus
      const payload = ssoService.verifySsoToken(ssoToken);

      // Find or create the CRM user
      const result = await ssoService.findOrCreateUser(payload);

      // Set refresh token cookie (same as regular login)
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json(ApiResponse.success('SSO login successful', {
        user: result.user,
        roles: result.roles,
        permissions: result.permissions,
        accessToken: result.accessToken,
      }));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ssoController;
