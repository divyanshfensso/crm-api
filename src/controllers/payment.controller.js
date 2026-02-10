const paymentService = require('../services/payment.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const paymentController = {
  /**
   * Get all payments with pagination and filters
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await paymentService.getAll(req.query);
    res.json(
      ApiResponse.paginated(
        'Payments retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      )
    );
  }),

  /**
   * Get payment by ID
   */
  getById: asyncHandler(async (req, res) => {
    const payment = await paymentService.getById(req.params.id);
    res.json(ApiResponse.success('Payment retrieved successfully', { payment }));
  }),

  /**
   * Create a new payment
   */
  create: asyncHandler(async (req, res) => {
    const payment = await paymentService.create(req.body, req.user.id);
    await createAuditLog(
      req.user.id,
      'CREATE',
      'PAYMENT',
      payment.id,
      null,
      req.body,
      req
    );
    res.status(201).json(ApiResponse.created('Payment created successfully', { payment }));
  }),

  /**
   * Update a payment
   */
  update: asyncHandler(async (req, res) => {
    const payment = await paymentService.update(req.params.id, req.body);
    await createAuditLog(
      req.user.id,
      'UPDATE',
      'PAYMENT',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );
    res.json(ApiResponse.success('Payment updated successfully', { payment }));
  }),

  /**
   * Delete a payment
   */
  delete: asyncHandler(async (req, res) => {
    const payment = await paymentService.delete(req.params.id);
    await createAuditLog(
      req.user.id,
      'DELETE',
      'PAYMENT',
      parseInt(req.params.id),
      null,
      null,
      req
    );
    res.json(ApiResponse.success('Payment deleted successfully', { payment }));
  }),
};

module.exports = paymentController;
