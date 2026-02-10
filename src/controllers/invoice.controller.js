const invoiceService = require('../services/invoice.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const invoiceController = {
  /**
   * Get all invoices with pagination, search, and filters
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await invoiceService.getAll(req.query);
    res.json(
      ApiResponse.paginated(
        'Invoices retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      )
    );
  }),

  /**
   * Get invoice by ID
   */
  getById: asyncHandler(async (req, res) => {
    const invoice = await invoiceService.getById(req.params.id);
    res.json(ApiResponse.success('Invoice retrieved successfully', { invoice }));
  }),

  /**
   * Create a new invoice
   */
  create: asyncHandler(async (req, res) => {
    const invoice = await invoiceService.create(req.body, req.user.id);
    await createAuditLog(
      req.user.id,
      'CREATE',
      'INVOICE',
      invoice.id,
      null,
      req.body,
      req
    );
    res.status(201).json(ApiResponse.created('Invoice created successfully', { invoice }));
  }),

  /**
   * Update an invoice
   */
  update: asyncHandler(async (req, res) => {
    const invoice = await invoiceService.update(req.params.id, req.body);
    await createAuditLog(
      req.user.id,
      'UPDATE',
      'INVOICE',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );
    res.json(ApiResponse.success('Invoice updated successfully', { invoice }));
  }),

  /**
   * Delete an invoice
   */
  delete: asyncHandler(async (req, res) => {
    const invoice = await invoiceService.delete(req.params.id);
    await createAuditLog(
      req.user.id,
      'DELETE',
      'INVOICE',
      parseInt(req.params.id),
      null,
      null,
      req
    );
    res.json(ApiResponse.success('Invoice deleted successfully', { invoice }));
  }),

  /**
   * Get invoice statistics
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await invoiceService.getStats();
    res.json(ApiResponse.success('Invoice statistics retrieved successfully', stats));
  }),
};

module.exports = invoiceController;
