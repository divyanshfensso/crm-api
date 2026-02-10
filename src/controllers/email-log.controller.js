const emailLogService = require('../services/email-log.service');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/apiResponse');

const emailLogController = {
  /**
   * Get all email logs with pagination, search, and filters
   * GET /api/email-logs
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await emailLogService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Email logs retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get email log by ID
   * GET /api/email-logs/:id
   */
  getById: asyncHandler(async (req, res) => {
    const emailLog = await emailLogService.getById(req.params.id);
    res.json(ApiResponse.success('Email log retrieved successfully', { emailLog }));
  })
};

module.exports = emailLogController;
