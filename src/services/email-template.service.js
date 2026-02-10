const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const emailTemplateService = {
  /**
   * Get all email templates with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated email templates list
   */
  getAll: async (query) => {
    const { EmailTemplate, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, module, is_active } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name', 'subject']);
      Object.assign(where, searchCondition);
    }

    // Filter by module
    if (module) {
      where.module = module;
    }

    // Filter by is_active
    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }

    const { count, rows } = await EmailTemplate.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
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
   * Get email template by ID with full details
   * @param {number} id - Email template ID
   * @returns {Promise<Object>} Email template with relations
   */
  getById: async (id) => {
    const { EmailTemplate, User } = require('../models');

    const template = await EmailTemplate.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    return template;
  },

  /**
   * Create a new email template
   * @param {Object} data - Email template data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created email template
   */
  create: async (data, userId) => {
    const { EmailTemplate } = require('../models');

    const templateData = {
      ...data,
      created_by: userId
    };

    const template = await EmailTemplate.create(templateData);

    // Fetch the created template with relations
    return await emailTemplateService.getById(template.id);
  },

  /**
   * Update an existing email template
   * @param {number} id - Email template ID
   * @param {Object} data - Updated email template data
   * @returns {Promise<Object>} Updated email template
   */
  update: async (id, data) => {
    const { EmailTemplate } = require('../models');

    const template = await EmailTemplate.findByPk(id);

    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    await template.update(data);

    // Fetch the updated template with relations
    return await emailTemplateService.getById(id);
  },

  /**
   * Soft delete an email template
   * @param {number} id - Email template ID
   * @returns {Promise<Object>} Deleted email template
   */
  delete: async (id) => {
    const { EmailTemplate } = require('../models');

    const template = await EmailTemplate.findByPk(id);

    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    await template.destroy();

    return { id: template.id };
  }
};

module.exports = emailTemplateService;
