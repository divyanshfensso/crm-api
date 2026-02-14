const ApiError = require('../utils/apiError');
const { checkRateLimit, getRateLimitInfo } = require('../utils/rateLimiter');

/**
 * Map HTTP method to CRUD action
 */
const methodToAction = (method) => {
  switch (method.toUpperCase()) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
};

/**
 * Extract module name from request path
 * e.g., /api/contacts/123 -> contacts
 */
const extractModule = (path) => {
  // Remove /api/ prefix if present
  const cleaned = path.replace(/^\/api\//, '');
  // Get first segment
  const segment = cleaned.split('/')[0];
  // Normalize: kebab-case to snake_case
  return segment.replace(/-/g, '_');
};

/**
 * Check if the API key scopes allow access to the requested resource
 * @param {Array} scopes - Array of scope strings (e.g., ["contacts:read", "deals:*"])
 * @param {string} path - Request path
 * @param {string} method - HTTP method
 * @returns {boolean}
 */
const checkScopeAccess = (scopes, path, method) => {
  // Empty/null scopes = allow all (backwards compatible)
  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return true;
  }

  const action = methodToAction(method);
  const module = extractModule(path);

  return scopes.some((scope) => {
    if (scope === '*:*' || scope === '*') return true;
    const [scopeModule, scopeAction] = scope.split(':');
    if (scopeModule === module && (scopeAction === '*' || scopeAction === action)) return true;
    if (scopeModule === '*' && scopeAction === action) return true;
    return false;
  });
};

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

  // Rate limit check
  const rateLimit = result.rate_limit || 1000;
  const withinLimit = checkRateLimit(result.apiKeyId, rateLimit);
  const limitInfo = getRateLimitInfo(result.apiKeyId, rateLimit);

  // Always set rate limit headers
  res.setHeader('X-RateLimit-Limit', rateLimit);
  res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(limitInfo.resetAt / 1000));

  if (!withinLimit) {
    return next(ApiError.tooManyRequests('API key rate limit exceeded. Try again later.'));
  }

  // Scope check
  if (!checkScopeAccess(result.scopes, req.originalUrl, req.method)) {
    return next(ApiError.forbidden('API key does not have permission for this resource'));
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
