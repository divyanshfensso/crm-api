const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const apiKeyService = require('../services/api-key.service');

const apiKeyController = {
  /**
   * Generate a new API key
   * POST /api/api-keys
   */
  generate: asyncHandler(async (req, res) => {
    const result = await apiKeyService.generate(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'API_KEY',
      result.id,
      null,
      { name: req.body.name, scopes: req.body.scopes },
      req
    );

    res.status(201).json(ApiResponse.created('API key generated successfully. Store the raw_key securely — it will not be shown again.', { apiKey: result }));
  }),

  /**
   * Get all API keys with pagination
   * GET /api/api-keys
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await apiKeyService.getAll(req.query, req.user.id);
    res.json(ApiResponse.paginated(
      'API keys retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get API key by ID
   * GET /api/api-keys/:id
   */
  getById: asyncHandler(async (req, res) => {
    const apiKey = await apiKeyService.getById(req.params.id);
    res.json(ApiResponse.success('API key retrieved successfully', { apiKey }));
  }),

  /**
   * Revoke an API key
   * POST /api/api-keys/:id/revoke
   */
  revoke: asyncHandler(async (req, res) => {
    const apiKey = await apiKeyService.revoke(req.params.id);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'API_KEY',
      parseInt(req.params.id),
      null,
      { is_active: false },
      req
    );

    res.json(ApiResponse.success('API key revoked successfully', { apiKey }));
  }),

  /**
   * Delete an API key (soft delete)
   * DELETE /api/api-keys/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await apiKeyService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'API_KEY',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('API key deleted successfully', result));
  }),

  /**
   * Get API logs for a specific key
   * GET /api/api-keys/:id/logs
   */
  getLogs: asyncHandler(async (req, res) => {
    const result = await apiKeyService.getLogs(req.params.id, req.query);
    res.json(ApiResponse.paginated(
      'API key logs retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  })
};

module.exports = apiKeyController;
