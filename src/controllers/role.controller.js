const roleService = require('../services/role.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const roleController = {
  getAll: async (req, res, next) => {
    try {
      const roles = await roleService.getAll();
      res.json(ApiResponse.success('Roles retrieved', { roles }));
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const role = await roleService.getById(req.params.id);
      res.json(ApiResponse.success('Role retrieved', { role }));
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const role = await roleService.create(req.body);
      await createAuditLog(req.user.id, 'create', 'roles', role.id, null, req.body, req);
      res.status(201).json(ApiResponse.success('Role created', { role }));
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const role = await roleService.update(req.params.id, req.body);
      await createAuditLog(req.user.id, 'update', 'roles', parseInt(req.params.id), null, req.body, req);
      res.json(ApiResponse.success('Role updated', { role }));
    } catch (error) {
      next(error);
    }
  },

  updatePermissions: async (req, res, next) => {
    try {
      const role = await roleService.updatePermissions(req.params.id, req.body.permissionIds);
      await createAuditLog(req.user.id, 'update_permissions', 'roles', parseInt(req.params.id),
        null, { permissionIds: req.body.permissionIds }, req);
      res.json(ApiResponse.success('Role permissions updated', { role }));
    } catch (error) {
      next(error);
    }
  },

  delete: async (req, res, next) => {
    try {
      const role = await roleService.delete(req.params.id);
      await createAuditLog(req.user.id, 'delete', 'roles', parseInt(req.params.id), null, null, req);
      res.json(ApiResponse.success('Role deleted', { role }));
    } catch (error) {
      next(error);
    }
  },

  getAllPermissions: async (req, res, next) => {
    try {
      const { Permission } = require('../models');
      const permissions = await Permission.findAll({ order: [['module', 'ASC'], ['action', 'ASC']] });
      res.json(ApiResponse.success('Permissions retrieved', { permissions }));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = roleController;
