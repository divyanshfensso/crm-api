const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const webhookService = require('../services/webhook.service');

const webhookController = {
  /**
   * Get all webhooks with pagination
   * GET /api/webhooks
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await webhookService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Webhooks retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get webhook by ID
   * GET /api/webhooks/:id
   */
  getById: asyncHandler(async (req, res) => {
    const webhook = await webhookService.getById(req.params.id);
    res.json(ApiResponse.success('Webhook retrieved successfully', { webhook }));
  }),

  /**
   * Create a new webhook
   * POST /api/webhooks
   */
  create: asyncHandler(async (req, res) => {
    const webhook = await webhookService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'WEBHOOK',
      webhook.id,
      null,
      { name: req.body.name, url: req.body.url, events: req.body.events },
      req
    );

    res.status(201).json(ApiResponse.created('Webhook created successfully', { webhook }));
  }),

  /**
   * Update an existing webhook
   * PUT /api/webhooks/:id
   */
  update: asyncHandler(async (req, res) => {
    const webhook = await webhookService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'WEBHOOK',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Webhook updated successfully', { webhook }));
  }),

  /**
   * Delete a webhook (soft delete)
   * DELETE /api/webhooks/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await webhookService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'WEBHOOK',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Webhook deleted successfully', result));
  }),

  /**
   * Get deliveries for a specific webhook
   * GET /api/webhooks/:id/deliveries
   */
  getDeliveries: asyncHandler(async (req, res) => {
    const result = await webhookService.getDeliveries(req.params.id, req.query);
    res.json(ApiResponse.paginated(
      'Webhook deliveries retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Retry a failed webhook delivery
   * POST /api/webhooks/deliveries/:deliveryId/retry
   */
  retryDelivery: asyncHandler(async (req, res) => {
    const delivery = await webhookService.retryDelivery(req.params.deliveryId);
    res.json(ApiResponse.success('Webhook delivery retry completed', { delivery }));
  }),

  /**
   * Send a test delivery to a webhook
   * POST /api/webhooks/:id/test
   */
  test: asyncHandler(async (req, res) => {
    const result = await webhookService.test(req.params.id);
    res.json(ApiResponse.success('Test webhook delivery sent', result));
  })
};

module.exports = webhookController;
