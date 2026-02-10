const ApiError = require('../utils/apiError');

const roleService = {
  getAll: async () => {
    const { Role, Permission } = require('../models');

    const roles = await Role.findAll({
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
      order: [['name', 'ASC']],
    });

    return roles;
  },

  getById: async (id) => {
    const { Role, Permission } = require('../models');

    const role = await Role.findByPk(id, {
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    return role;
  },

  create: async (data) => {
    const { Role } = require('../models');

    const existing = await Role.findOne({ where: { name: data.name } });
    if (existing) {
      throw ApiError.badRequest('Role name already exists');
    }

    const role = await Role.create({
      name: data.name,
      description: data.description || null,
      is_system: false,
    });

    // Assign permissions if provided
    if (data.permissionIds && data.permissionIds.length > 0) {
      const { Permission } = require('../models');
      const permissions = await Permission.findAll({ where: { id: data.permissionIds } });
      await role.setPermissions(permissions);
    }

    return role;
  },

  update: async (id, data) => {
    const { Role } = require('../models');

    const role = await Role.findByPk(id);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    if (role.is_system) {
      throw ApiError.badRequest('Cannot modify system roles');
    }

    if (data.name) {
      const existing = await Role.findOne({ where: { name: data.name, id: { [require('sequelize').Op.ne]: id } } });
      if (existing) {
        throw ApiError.badRequest('Role name already exists');
      }
    }

    await role.update({
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
    });

    return role;
  },

  updatePermissions: async (id, permissionIds) => {
    const { Role, Permission } = require('../models');

    const role = await Role.findByPk(id);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    const permissions = await Permission.findAll({ where: { id: permissionIds } });
    await role.setPermissions(permissions);

    // Re-fetch with permissions
    const updated = await Role.findByPk(id, {
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });

    return updated;
  },

  delete: async (id) => {
    const { Role } = require('../models');

    const role = await Role.findByPk(id);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    if (role.is_system) {
      throw ApiError.badRequest('Cannot delete system roles');
    }

    await role.destroy();
    return role;
  },
};

module.exports = roleService;
