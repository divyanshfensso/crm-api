const quoteService = require('../services/quote.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const quoteController = {
  /**
   * Get all quotes with pagination, search, and filters
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await quoteService.getAll(req.query);
    res.json(
      ApiResponse.paginated(
        'Quotes retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      )
    );
  }),

  /**
   * Get quote by ID
   */
  getById: asyncHandler(async (req, res) => {
    const quote = await quoteService.getById(req.params.id);
    res.json(ApiResponse.success('Quote retrieved successfully', { quote }));
  }),

  /**
   * Create a new quote
   */
  create: asyncHandler(async (req, res) => {
    const quote = await quoteService.create(req.body, req.user.id);
    await createAuditLog(
      req.user.id,
      'CREATE',
      'QUOTE',
      quote.id,
      null,
      req.body,
      req
    );
    res.status(201).json(ApiResponse.created('Quote created successfully', { quote }));
  }),

  /**
   * Update a quote
   */
  update: asyncHandler(async (req, res) => {
    const quote = await quoteService.update(req.params.id, req.body);
    await createAuditLog(
      req.user.id,
      'UPDATE',
      'QUOTE',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );
    res.json(ApiResponse.success('Quote updated successfully', { quote }));
  }),

  /**
   * Delete a quote
   */
  delete: asyncHandler(async (req, res) => {
    const quote = await quoteService.delete(req.params.id);
    await createAuditLog(
      req.user.id,
      'DELETE',
      'QUOTE',
      parseInt(req.params.id),
      null,
      null,
      req
    );
    res.json(ApiResponse.success('Quote deleted successfully', { quote }));
  }),

  /**
   * Convert a quote to an invoice
   */
  convertToInvoice: asyncHandler(async (req, res) => {
    const invoice = await quoteService.convertToInvoice(req.params.id, req.user.id);
    await createAuditLog(
      req.user.id,
      'CREATE',
      'INVOICE',
      invoice.id,
      null,
      { converted_from_quote: req.params.id },
      req
    );
    res.status(201).json(ApiResponse.created('Quote converted to invoice successfully', { invoice }));
  }),

  /**
   * Get quote statistics
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await quoteService.getStats();
    res.json(ApiResponse.success('Quote statistics retrieved successfully', stats));
  }),
};

module.exports = quoteController;
