const { Op } = require('sequelize');
const { getPagination } = require('../utils/pagination');

const auditService = {
  getAll: async (query) => {
    const { AuditLog, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { module, action, userId, startDate, endDate, sortOrder = 'DESC' } = query;

    const where = {};
    if (module) where.module = module;
    if (action) where.action = action;
    if (userId) where.user_id = userId;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      }],
      order: [['created_at', sortOrder.toUpperCase()]],
      limit,
      offset,
    });

    return {
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  },
};

module.exports = auditService;
