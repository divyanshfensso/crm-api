const ApiError = require('../utils/apiError');

const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return next(ApiError.unauthorized('API key is required'));
  }

  // Lazy require to avoid circular deps
  const apiKeyService = require('../services/api-key.service');
  const result = await apiKeyService.verifyKey(apiKey);

  if (!result) {
    return next(ApiError.unauthorized('Invalid or expired API key'));
  }

  req.user = { id: result.user_id };
  req.apiKey = { id: result.apiKeyId, scopes: result.scopes };

  // Log the API request
  const start = Date.now();
  res.on('finish', () => {
    apiKeyService.logRequest(result.apiKeyId, req.method, req.originalUrl, res.statusCode, Date.now() - start, req).catch(() => {});
  });

  next();
};

module.exports = { apiKeyAuth };
