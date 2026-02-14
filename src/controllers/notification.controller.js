const notificationService = require('../services/notification.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const notificationController = {
  getAll: asyncHandler(async (req, res) => {
    const result = await notificationService.getAll(req.user.id, req.query);
    res.json(ApiResponse.paginated(
      'Notifications retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  getUnreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json(ApiResponse.success('Unread count retrieved', { count }));
  }),

  getById: asyncHandler(async (req, res) => {
    const notification = await notificationService.getById(req.params.id, req.user.id);
    res.json(ApiResponse.success('Notification retrieved', { notification }));
  }),

  markAsRead: asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json(ApiResponse.success('Notification marked as read', { notification }));
  }),

  markAllAsRead: asyncHandler(async (req, res) => {
    const count = await notificationService.markAllAsRead(req.user.id);
    res.json(ApiResponse.success(`${count} notifications marked as read`, { count }));
  }),

  delete: asyncHandler(async (req, res) => {
    const result = await notificationService.delete(req.params.id, req.user.id);
    res.json(ApiResponse.success('Notification deleted', result));
  }),

  deleteRead: asyncHandler(async (req, res) => {
    const count = await notificationService.deleteRead(req.user.id);
    res.json(ApiResponse.success(`${count} notifications deleted`, { count }));
  })
};

module.exports = notificationController;
