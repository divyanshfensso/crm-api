const userService = require('../services/user.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const userController = {
  getAll: async (req, res, next) => {
    try {
      const result = await userService.getAll(req.query);
      res.json(ApiResponse.success('Users retrieved', result.data, result.meta));
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const user = await userService.getById(req.params.id);
      res.json(ApiResponse.success('User retrieved', { user }));
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const { user, oldValues } = await userService.update(req.params.id, req.body);
      await createAuditLog(req.user.id, 'update', 'users', parseInt(req.params.id), oldValues, req.body, req);
      res.json(ApiResponse.success('User updated', { user }));
    } catch (error) {
      next(error);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { user, oldStatus } = await userService.updateStatus(req.params.id, req.body.status);
      await createAuditLog(req.user.id, 'update_status', 'users', parseInt(req.params.id),
        { status: oldStatus }, { status: req.body.status }, req);
      res.json(ApiResponse.success('User status updated', { user }));
    } catch (error) {
      next(error);
    }
  },

  delete: async (req, res, next) => {
    try {
      const user = await userService.delete(req.params.id);
      await createAuditLog(req.user.id, 'delete', 'users', parseInt(req.params.id), null, null, req);
      res.json(ApiResponse.success('User deactivated', { user }));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userController;
