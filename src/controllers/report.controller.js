const reportService = require('../services/report.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const reportController = {
  /**
   * Get all reports with pagination, search, and filters
   * GET /api/reports
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await reportService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Reports retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get report by ID
   * GET /api/reports/:id
   */
  getById: asyncHandler(async (req, res) => {
    const report = await reportService.getById(req.params.id);
    res.json(ApiResponse.success('Report retrieved successfully', { report }));
  }),

  /**
   * Create a new report
   * POST /api/reports
   */
  create: asyncHandler(async (req, res) => {
    const report = await reportService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'REPORT',
      report.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Report created successfully', { report }));
  }),

  /**
   * Update an existing report
   * PUT /api/reports/:id
   */
  update: asyncHandler(async (req, res) => {
    const report = await reportService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'REPORT',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Report updated successfully', { report }));
  }),

  /**
   * Delete a report (soft delete)
   * DELETE /api/reports/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await reportService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'REPORT',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Report deleted successfully', result));
  }),

  /**
   * Execute a report (dynamic query)
   * POST /api/reports/:id/execute
   */
  executeReport: asyncHandler(async (req, res) => {
    const result = await reportService.executeReport(req.params.id, req.body);
    res.json(ApiResponse.paginated(
      'Report executed successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Export a report as CSV or JSON
   * POST /api/reports/:id/export
   */
  exportReport: asyncHandler(async (req, res) => {
    const { format = 'csv' } = req.body;
    const buffer = await reportService.exportReport(req.params.id, format, req.body);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=report.json');
    }

    res.send(buffer);
  })
};

module.exports = reportController;
