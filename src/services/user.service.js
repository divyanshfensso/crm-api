const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/apiError');
const { getPagination } = require('../utils/pagination');

const userService = {
  create: async (data) => {
    const { User, Role } = require('../models');

    // Check email uniqueness
    const existing = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      throw ApiError.badRequest('Email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 10);

    const user = await User.create({
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || null,
      password_hash,
      status: 'active',
    });

    // Assign roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      const roles = await Role.findAll({ where: { id: data.roleIds } });
      await user.setRoles(roles);
    }

    return user.toSafeObject();
  },

  getAll: async (query) => {
    const { User, Role } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, sortBy = 'created_at', sortOrder = 'DESC' } = query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  },

  getById: async (id) => {
    const { User, Role, Permission } = require('../models');

    const user = await User.findByPk(id, {
      include: [{
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
      }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  },

  update: async (id, data) => {
    const { User } = require('../models');

    const user = await User.findByPk(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const oldValues = {
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      status: user.status,
    };

    await user.update({
      ...(data.firstName && { first_name: data.firstName }),
      ...(data.lastName && { last_name: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.status && { status: data.status }),
    });

    // Update roles if provided
    if (data.roleIds) {
      const { Role } = require('../models');
      const roles = await Role.findAll({ where: { id: data.roleIds } });
      await user.setRoles(roles);
    }

    return { user: user.toSafeObject(), oldValues };
  },

  updateStatus: async (id, status) => {
    const { User } = require('../models');

    const user = await User.findByPk(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const oldStatus = user.status;
    await user.update({ status });

    return { user: user.toSafeObject(), oldStatus };
  },

  delete: async (id) => {
    const { User } = require('../models');

    const user = await User.findByPk(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    await user.update({ status: 'inactive' });
    return user.toSafeObject();
  },
};

module.exports = userService;
