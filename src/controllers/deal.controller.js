const dealService = require('../services/deal.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const dealController = {
  /**
   * Get all deals with pagination, search, and filters
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await dealService.getAll(req.query, req.user.id, req.userRoles);
    res.json(
      ApiResponse.paginated(
        'Deals retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      )
    );
  }),

  /**
   * Get deal by ID
   */
  getById: asyncHandler(async (req, res) => {
    const deal = await dealService.getById(req.params.id);
    res.json(ApiResponse.success('Deal retrieved successfully', { deal }));
  }),

  /**
   * Create a new deal
   */
  create: asyncHandler(async (req, res) => {
    const deal = await dealService.create(req.body, req.user.id);
    await createAuditLog(
      req.user.id,
      'CREATE',
      'DEAL',
      deal.id,
      null,
      req.body,
      req
    );
    res.status(201).json(ApiResponse.created('Deal created successfully', { deal }));
  }),

  /**
   * Update a deal
   */
  update: asyncHandler(async (req, res) => {
    const deal = await dealService.update(req.params.id, req.body);
    await createAuditLog(
      req.user.id,
      'UPDATE',
      'DEAL',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );
    res.json(ApiResponse.success('Deal updated successfully', { deal }));
  }),

  /**
   * Update deal stage
   */
  updateStage: asyncHandler(async (req, res) => {
    const { stageId } = req.body;
    const deal = await dealService.updateStage(req.params.id, stageId);
    await createAuditLog(
      req.user.id,
      'UPDATE',
      'DEAL',
      parseInt(req.params.id),
      null,
      { stageId },
      req
    );
    res.json(ApiResponse.success('Deal stage updated successfully', { deal }));
  }),

  /**
   * Delete a deal
   */
  delete: asyncHandler(async (req, res) => {
    const deal = await dealService.delete(req.params.id);
    await createAuditLog(
      req.user.id,
      'DELETE',
      'DEAL',
      parseInt(req.params.id),
      null,
      null,
      req
    );
    res.json(ApiResponse.success('Deal deleted successfully', { deal }));
  }),

  /**
   * Get deals by pipeline (for kanban view)
   */
  getByPipeline: asyncHandler(async (req, res) => {
    const pipelineId = req.params.pipelineId || null;
    const result = await dealService.getByPipeline(pipelineId, req.user.id, req.userRoles);
    res.json(ApiResponse.success('Pipeline deals retrieved successfully', result));
  }),

  /**
   * Get deal statistics
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await dealService.getStats();
    res.json(ApiResponse.success('Deal statistics retrieved successfully', stats));
  }),
};

module.exports = dealController;
