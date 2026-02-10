const taskService = require('../services/task.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const taskController = {
  /**
   * Get all tasks with pagination, search, and filters
   * GET /api/tasks
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await taskService.getAll(req.query, req.user.id, req.userRoles);
    res.json(ApiResponse.paginated(
      'Tasks retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get task by ID
   * GET /api/tasks/:id
   */
  getById: asyncHandler(async (req, res) => {
    const task = await taskService.getById(req.params.id);
    res.json(ApiResponse.success('Task retrieved successfully', { task }));
  }),

  /**
   * Create a new task
   * POST /api/tasks
   */
  create: asyncHandler(async (req, res) => {
    const task = await taskService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'TASK',
      task.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Task created successfully', { task }));
  }),

  /**
   * Update an existing task
   * PUT /api/tasks/:id
   */
  update: asyncHandler(async (req, res) => {
    const task = await taskService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'TASK',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Task updated successfully', { task }));
  }),

  /**
   * Delete a task (soft delete)
   * DELETE /api/tasks/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await taskService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'TASK',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Task deleted successfully', result));
  }),

  /**
   * Get task statistics
   * GET /api/tasks/stats
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await taskService.getStats();
    res.json(ApiResponse.success('Task statistics retrieved successfully', { stats }));
  }),

  /**
   * Get tasks grouped by status for kanban board
   * GET /api/tasks/board
   */
  getByStatus: asyncHandler(async (req, res) => {
    const board = await taskService.getByStatus();
    res.json(ApiResponse.success('Task board retrieved successfully', { board }));
  })
};

module.exports = taskController;
