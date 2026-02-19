const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields, parseJsonFields, parseJsonFieldsArray } = require('../utils/helpers');

const companyService = {
  /**
   * Get all companies with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @param {number} userId - Current user ID
   * @param {Array} userRoles - Current user roles
   * @returns {Promise<Object>} Paginated companies list
   */
  getAll: async (query, userId, userRoles) => {
    const { Company, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, industry } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Role-based filtering: Sales Reps see only their own companies
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    if (isSalesRep) {
      where.owner_id = userId;
    }

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name', 'email', 'industry']);
      Object.assign(where, searchCondition);
    }

    // Filter by industry
    if (industry) {
      where.industry = industry;
    }

    const { count, rows } = await Company.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      order,
      limit,
      offset,
      distinct: true
    });

    return {
      data: parseJsonFieldsArray(rows, ['custom_fields', 'tags'], { custom_fields: {}, tags: [] }),
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasNextPage: page < Math.ceil(count / limit),
        hasPrevPage: page > 1
      }
    };
  },

  /**
   * Get company by ID with full details
   * @param {number} id - Company ID
   * @returns {Promise<Object>} Company with relations
   */
  getById: async (id) => {
    const { Company, User, Contact, Deal, sequelize } = require('../models');

    const company = await Company.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Contact,
          as: 'contacts',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'job_title', 'status'],
          limit: 10,
          order: [['created_at', 'DESC']]
        },
        {
          model: Deal,
          as: 'deals',
          attributes: ['id', 'title', 'value', 'stage_id', 'status', 'expected_close_date'],
          limit: 10,
          order: [['created_at', 'DESC']]
        },
        {
          model: Company,
          as: 'subsidiaries',
          attributes: ['id', 'name', 'industry', 'website', 'phone', 'email']
        }
      ]
    });

    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    // Add counts for contacts and deals
    const contactsCount = await Contact.count({ where: { company_id: id } });
    const dealsCount = await Deal.count({ where: { company_id: id } });

    const companyData = parseJsonFields(company, ['custom_fields', 'tags'], { custom_fields: {}, tags: [] });
    companyData.contacts_count = contactsCount;
    companyData.deals_count = dealsCount;

    return companyData;
  },

  /**
   * Create a new company
   * @param {Object} data - Company data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created company
   */
  create: async (data, userId) => {
    const { Company } = require('../models');

    // Sanitize FK fields and set defaults
    const cleanData = sanitizeFKFields(data, ['owner_id', 'parent_company_id']);
    const companyData = {
      ...cleanData,
      created_by: userId,
      owner_id: cleanData.owner_id || userId
    };

    const company = await Company.create(companyData);

    // Fetch the created company with relations
    return await companyService.getById(company.id);
  },

  /**
   * Update an existing company
   * @param {number} id - Company ID
   * @param {Object} data - Updated company data
   * @returns {Promise<Object>} Updated company
   */
  update: async (id, data) => {
    const { Company } = require('../models');

    const company = await Company.findByPk(id);

    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    const cleanData = sanitizeFKFields(data, ['owner_id', 'parent_company_id']);
    await company.update(cleanData);

    // Fetch the updated company with relations
    return await companyService.getById(id);
  },

  /**
   * Soft delete a company
   * @param {number} id - Company ID
   * @returns {Promise<Object>} Deleted company
   */
  delete: async (id) => {
    const { Company } = require('../models');

    const company = await Company.findByPk(id);

    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    await company.destroy();

    return { id: company.id };
  },

  /**
   * Get company statistics by industry
   * @returns {Promise<Object>} Company stats
   */
  getStats: async () => {
    const { Company, sequelize } = require('../models');

    const stats = await Company.findAll({
      attributes: [
        'industry',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        industry: { [Op.ne]: null }
      },
      group: ['industry'],
      raw: true,
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
    });

    // Get total count
    const totalCount = await Company.count();

    // Format the stats into a more usable object
    const formattedStats = {
      total: totalCount,
      by_industry: {}
    };

    stats.forEach(stat => {
      if (stat.industry) {
        formattedStats.by_industry[stat.industry] = parseInt(stat.count);
      }
    });

    return formattedStats;
  }
};

module.exports = companyService;
