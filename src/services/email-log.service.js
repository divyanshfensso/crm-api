const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const emailLogService = {
  /**
   * Get all email logs with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated email logs list
   */
  getAll: async (query) => {
    const { EmailLog, EmailTemplate, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, template_id } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['recipient_email', 'subject']);
      Object.assign(where, searchCondition);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by template
    if (template_id) {
      where.template_id = template_id;
    }

    const { count, rows } = await EmailLog.findAndCountAll({
      where,
      include: [
        {
          model: EmailTemplate,
          as: 'template',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name']
        }
      ],
      order,
      limit,
      offset,
      distinct: true
    });

    return {
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  },

  /**
   * Get email log by ID with full details
   * @param {number} id - Email log ID
   * @returns {Promise<Object>} Email log with relations
   */
  getById: async (id) => {
    const { EmailLog, EmailTemplate, User } = require('../models');

    const emailLog = await EmailLog.findByPk(id, {
      include: [
        {
          model: EmailTemplate,
          as: 'template',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    if (!emailLog) {
      throw ApiError.notFound('Email log not found');
    }

    return emailLog;
  }
};

module.exports = emailLogService;
