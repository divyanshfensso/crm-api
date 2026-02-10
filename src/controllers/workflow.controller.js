const workflowService = require('../services/workflow.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const workflowController = {
  /**
   * Get all workflows with pagination, search, and filters
   * GET /api/workflows
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await workflowService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Workflows retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get workflow by ID
   * GET /api/workflows/:id
   */
  getById: asyncHandler(async (req, res) => {
    const workflow = await workflowService.getById(req.params.id);
    res.json(ApiResponse.success('Workflow retrieved successfully', { workflow }));
  }),

  /**
   * Create a new workflow
   * POST /api/workflows
   */
  create: asyncHandler(async (req, res) => {
    const workflow = await workflowService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'WORKFLOW',
      workflow.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Workflow created successfully', { workflow }));
  }),

  /**
   * Update an existing workflow
   * PUT /api/workflows/:id
   */
  update: asyncHandler(async (req, res) => {
    const workflow = await workflowService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'WORKFLOW',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Workflow updated successfully', { workflow }));
  }),

  /**
   * Delete a workflow (soft delete)
   * DELETE /api/workflows/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await workflowService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'WORKFLOW',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Workflow deleted successfully', result));
  }),

  /**
   * Execute a workflow
   * POST /api/workflows/:id/execute
   */
  execute: asyncHandler(async (req, res) => {
    const log = await workflowService.execute(req.params.id, req.body || {});

    await createAuditLog(
      req.user.id,
      'EXECUTE',
      'WORKFLOW',
      parseInt(req.params.id),
      null,
      { context: req.body },
      req
    );

    res.json(ApiResponse.success('Workflow executed successfully', { log }));
  }),

  /**
   * Test (dry run) a workflow
   * POST /api/workflows/:id/test
   */
  test: asyncHandler(async (req, res) => {
    const result = await workflowService.test(req.params.id, req.body || {});
    res.json(ApiResponse.success('Workflow test completed', { result }));
  }),

  /**
   * Get workflow execution logs
   * GET /api/workflows/:id/logs
   */
  getLogs: asyncHandler(async (req, res) => {
    const result = await workflowService.getLogs(req.params.id, req.query);
    res.json(ApiResponse.paginated(
      'Workflow logs retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),
};

module.exports = workflowController;
