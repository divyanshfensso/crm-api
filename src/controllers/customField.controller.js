const customFieldService = require('../services/customField.service');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const customFieldController = {
  /**
   * Get custom fields for a specific entity type
   * GET /api/custom-fields?entity_type=contacts
   */
  getByEntity: asyncHandler(async (req, res) => {
    const { entity_type } = req.query;
    if (!entity_type) {
      throw ApiError.badRequest('entity_type query parameter is required');
    }
    const fields = await customFieldService.getByEntity(entity_type, req.user.id);
    res.json(ApiResponse.success('Custom fields retrieved', { fields }));
  }),

  /**
   * Get all custom fields for current user
   * GET /api/custom-fields/all
   */
  getAll: asyncHandler(async (req, res) => {
    const fields = await customFieldService.getAllForUser(req.user.id);
    res.json(ApiResponse.success('Custom fields retrieved', { fields }));
  }),

  /**
   * Create a single custom field
   * POST /api/custom-fields
   */
  create: asyncHandler(async (req, res) => {
    const field = await customFieldService.create(req.body, req.user.id);
    res.status(201).json(ApiResponse.created('Custom field created', { field }));
  }),

  /**
   * Create multiple custom fields (for import)
   * POST /api/custom-fields/bulk
   */
  bulkCreate: asyncHandler(async (req, res) => {
    const { fields } = req.body;
    if (!Array.isArray(fields) || fields.length === 0) {
      throw ApiError.badRequest('fields array is required');
    }
    const created = await customFieldService.bulkCreate(fields, req.user.id);
    res.status(201).json(ApiResponse.created('Custom fields created', { fields: created }));
  }),

  /**
   * Update a custom field
   * PUT /api/custom-fields/:id
   */
  update: asyncHandler(async (req, res) => {
    const field = await customFieldService.update(req.params.id, req.body, req.user.id);
    res.json(ApiResponse.success('Custom field updated', { field }));
  }),

  /**
   * Delete a custom field
   * DELETE /api/custom-fields/:id
   */
  delete: asyncHandler(async (req, res) => {
    await customFieldService.delete(req.params.id, req.user.id);
    res.json(ApiResponse.success('Custom field deleted'));
  })
};

module.exports = customFieldController;
