const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields, parseJsonFields, parseJsonFieldsArray } = require('../utils/helpers');

const contactService = {
  /**
   * Get all contacts with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @param {number} userId - Current user ID
   * @param {Array} userRoles - Current user roles
   * @returns {Promise<Object>} Paginated contacts list
   */
  getAll: async (query, userId, userRoles) => {
    const { Contact, User, Company } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, lead_source, company_id, owner_id } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Role-based filtering: Sales Reps see only their own contacts
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    if (isSalesRep) {
      where.owner_id = userId;
    }

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['first_name', 'last_name', 'email']);
      Object.assign(where, searchCondition);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by lead source
    if (lead_source) {
      where.lead_source = lead_source;
    }

    // Filter by company
    if (company_id) {
      where.company_id = company_id;
    }

    // Filter by owner
    if (owner_id) {
      where.owner_id = owner_id;
    }

    const { count, rows } = await Contact.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
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
   * Get contact by ID with full details
   * @param {number} id - Contact ID
   * @returns {Promise<Object>} Contact with relations
   */
  getById: async (id) => {
    const { Contact, User, Company, Deal, Activity } = require('../models');

    const contact = await Contact.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'industry', 'website', 'phone', 'email']
        },
        {
          model: Deal,
          as: 'deals',
          attributes: ['id', 'title', 'value', 'status', 'expected_close_date']
        },
        {
          model: Activity,
          as: 'activities',
          attributes: ['id', 'type', 'subject', 'description', 'due_date', 'completed'],
          limit: 10
        }
      ]
    });

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    return parseJsonFields(contact, ['custom_fields', 'tags'], { custom_fields: {}, tags: [] });
  },

  /**
   * Create a new contact
   * @param {Object} data - Contact data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created contact
   */
  create: async (data, userId) => {
    const { Contact } = require('../models');

    // Sanitize FK fields and set defaults
    const cleanData = sanitizeFKFields(data, ['company_id', 'owner_id']);
    const contactData = {
      ...cleanData,
      created_by: userId,
      owner_id: cleanData.owner_id || userId
    };

    const contact = await Contact.create(contactData);

    // Fetch the created contact with relations
    return await contactService.getById(contact.id);
  },

  /**
   * Update an existing contact
   * @param {number} id - Contact ID
   * @param {Object} data - Updated contact data
   * @returns {Promise<Object>} Updated contact
   */
  update: async (id, data) => {
    const { Contact } = require('../models');

    const contact = await Contact.findByPk(id);

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    const cleanData = sanitizeFKFields(data, ['company_id', 'owner_id']);
    await contact.update(cleanData);

    // Fetch the updated contact with relations
    return await contactService.getById(id);
  },

  /**
   * Soft delete a contact
   * @param {number} id - Contact ID
   * @returns {Promise<Object>} Deleted contact
   */
  delete: async (id) => {
    const { Contact } = require('../models');

    const contact = await Contact.findByPk(id);

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    await contact.destroy();

    return { id: contact.id };
  },

  /**
   * Get contact statistics by status
   * @returns {Promise<Object>} Contact stats
   */
  getStats: async () => {
    const { Contact, sequelize } = require('../models');

    const stats = await Contact.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Format the stats into a more usable object
    const formattedStats = {
      total: 0,
      by_status: {}
    };

    stats.forEach(stat => {
      formattedStats.by_status[stat.status] = parseInt(stat.count);
      formattedStats.total += parseInt(stat.count);
    });

    return formattedStats;
  }
};

module.exports = contactService;
