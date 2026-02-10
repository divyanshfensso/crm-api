const dataExportService = require('../services/data-export.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const dataExportController = {
  /**
   * Create a new data export request
   * POST /api/data-exports
   */
  create: asyncHandler(async (req, res) => {
    const { entity_types, format } = req.body;
    const exportRecord = await dataExportService.create(entity_types, format, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'DATA_EXPORT',
      exportRecord.id,
      null,
      { entity_types, format },
      req
    );

    res.status(201).json(ApiResponse.created('Data export request created successfully', { export: exportRecord }));
  }),

  /**
   * Get all data exports for current user
   * GET /api/data-exports
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await dataExportService.getAll(req.query, req.user.id);
    res.json(ApiResponse.paginated(
      'Data exports retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get data export by ID
   * GET /api/data-exports/:id
   */
  getById: asyncHandler(async (req, res) => {
    const exportRecord = await dataExportService.getById(req.params.id);
    res.json(ApiResponse.success('Data export retrieved successfully', { export: exportRecord }));
  }),

  /**
   * Download an export file
   * GET /api/data-exports/:id/download
   */
  download: asyncHandler(async (req, res) => {
    const filePath = await dataExportService.downloadExport(req.params.id, req.user.id);
    const filename = filePath.split(/[\\/]/).pop();
    res.download(filePath, filename);
  }),

  /**
   * Delete a data export and its file
   * DELETE /api/data-exports/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await dataExportService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'DATA_EXPORT',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Data export deleted successfully', result));
  })
};

module.exports = dataExportController;
