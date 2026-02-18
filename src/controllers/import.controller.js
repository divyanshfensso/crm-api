const importService = require('../services/import.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const importController = {
  /**
   * Get all import jobs with pagination, search, and filters
   * GET /api/imports
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await importService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Import jobs retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get import job by ID
   * GET /api/imports/:id
   */
  getById: asyncHandler(async (req, res) => {
    const importJob = await importService.getById(req.params.id);
    res.json(ApiResponse.success('Import job retrieved successfully', { importJob }));
  }),

  /**
   * Get CSV template for entity type
   * GET /api/imports/template/:entityType
   */
  getTemplate: asyncHandler(async (req, res) => {
    const { entityType } = req.params;
    const csv = importService.getTemplate(entityType);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${entityType}-template.csv`);
    res.send(csv);
  }),

  /**
   * Upload a CSV file for import
   * POST /api/imports/upload
   */
  upload: asyncHandler(async (req, res) => {
    const importJob = await importService.upload(req.file, req.body.entity_type, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'IMPORT',
      importJob.id,
      null,
      { filename: importJob.filename, entity_type: importJob.entity_type },
      req
    );

    res.status(201).json(ApiResponse.created('File uploaded successfully', { importJob }));
  }),

  /**
   * Preview the first 10 rows of an import file
   * GET /api/imports/:id/preview
   */
  preview: asyncHandler(async (req, res) => {
    const preview = await importService.preview(req.params.id);
    res.json(ApiResponse.success('Import preview generated successfully', { preview }));
  }),

  /**
   * Save column mapping for an import job
   * POST /api/imports/:id/mapping
   */
  mapColumns: asyncHandler(async (req, res) => {
    const importJob = await importService.mapColumns(req.params.id, req.body.column_mapping);
    res.json(ApiResponse.success('Column mapping saved successfully', { importJob }));
  }),

  /**
   * Update entity type for an import job (after AI detection)
   * PUT /api/imports/:id/entity-type
   */
  updateEntityType: asyncHandler(async (req, res) => {
    const { entity_type } = req.body;
    if (!entity_type) {
      throw ApiError.badRequest('entity_type is required');
    }
    const importJob = await importService.updateEntityType(req.params.id, entity_type);
    res.json(ApiResponse.success('Entity type updated successfully', { importJob }));
  }),

  /**
   * Validate import data before processing (dry-run)
   * POST /api/imports/:id/validate
   */
  validate: asyncHandler(async (req, res) => {
    const result = await importService.validate(req.params.id);
    res.json(ApiResponse.success('Import validation complete', result));
  }),

  /**
   * Process an import job
   * POST /api/imports/:id/process
   */
  process: asyncHandler(async (req, res) => {
    const importJob = await importService.process(req.params.id);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'IMPORT',
      importJob.id,
      null,
      { status: importJob.status, success_count: importJob.success_count, error_count: importJob.error_count },
      req
    );

    res.json(ApiResponse.success('Import processed successfully', { importJob }));
  })
};

module.exports = importController;
