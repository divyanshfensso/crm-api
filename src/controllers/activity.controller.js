const activityService = require('../services/activity.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');

class ActivityController {
  getAll = asyncHandler(async (req, res) => {
    const result = await activityService.getAll(req.query);

    res.json(
      ApiResponse.paginated(
        'Activities retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      )
    );
  });

  getById = asyncHandler(async (req, res) => {
    const activity = await activityService.getById(req.params.id);

    res.json(ApiResponse.success('Activity retrieved successfully', activity));
  });

  getRecent = asyncHandler(async (req, res) => {
    const limit = req.query.limit || 10;
    const activities = await activityService.getRecent(limit);

    res.json(ApiResponse.success('Recent activities retrieved successfully', activities));
  });

  create = asyncHandler(async (req, res) => {
    const activity = await activityService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'ACTIVITY',
      activity.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Activity created successfully', activity));
  });

  update = asyncHandler(async (req, res) => {
    const oldActivity = await activityService.getById(req.params.id);
    const activity = await activityService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'ACTIVITY',
      activity.id,
      oldActivity.toJSON(),
      req.body,
      req
    );

    res.json(ApiResponse.success('Activity updated successfully', activity));
  });

  delete = asyncHandler(async (req, res) => {
    const activity = await activityService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'ACTIVITY',
      activity.id,
      activity.toJSON(),
      null,
      req
    );

    res.json(ApiResponse.success('Activity deleted successfully', null));
  });
}

module.exports = new ActivityController();
