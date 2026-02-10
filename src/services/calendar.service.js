const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const calendarService = {
  /**
   * Get all calendar events with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated events list
   */
  getAll: async (query) => {
    const { CalendarEvent, User, Contact, Company, Deal } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, date_from, date_to, contact_id, company_id, deal_id } = query;
    const order = getSorting(query, 'start_time', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['title', 'description', 'location']);
      Object.assign(where, searchCondition);
    }

    // Filter by date range
    if (date_from || date_to) {
      where.start_time = {};
      if (date_from) {
        where.start_time[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        where.start_time[Op.lte] = new Date(date_to);
      }
    }

    // Filter by contact
    if (contact_id) {
      where.contact_id = contact_id;
    }

    // Filter by company
    if (company_id) {
      where.company_id = company_id;
    }

    // Filter by deal
    if (deal_id) {
      where.deal_id = deal_id;
    }

    const { count, rows } = await CalendarEvent.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
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
   * Get calendar event by ID with full details
   * @param {number} id - Event ID
   * @returns {Promise<Object>} Event with relations
   */
  getById: async (id) => {
    const { CalendarEvent, User, Contact, Company, Deal } = require('../models');

    const event = await CalendarEvent.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ]
    });

    if (!event) {
      throw ApiError.notFound('Calendar event not found');
    }

    return event;
  },

  /**
   * Create a new calendar event
   * @param {Object} data - Event data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created event
   */
  create: async (data, userId) => {
    const { CalendarEvent } = require('../models');

    const eventData = {
      ...data,
      created_by: userId
    };

    const event = await CalendarEvent.create(eventData);

    // Fetch the created event with relations
    return await calendarService.getById(event.id);
  },

  /**
   * Update an existing calendar event
   * @param {number} id - Event ID
   * @param {Object} data - Updated event data
   * @returns {Promise<Object>} Updated event
   */
  update: async (id, data) => {
    const { CalendarEvent } = require('../models');

    const event = await CalendarEvent.findByPk(id);

    if (!event) {
      throw ApiError.notFound('Calendar event not found');
    }

    await event.update(data);

    // Fetch the updated event with relations
    return await calendarService.getById(id);
  },

  /**
   * Soft delete a calendar event
   * @param {number} id - Event ID
   * @returns {Promise<Object>} Deleted event info
   */
  delete: async (id) => {
    const { CalendarEvent } = require('../models');

    const event = await CalendarEvent.findByPk(id);

    if (!event) {
      throw ApiError.notFound('Calendar event not found');
    }

    await event.destroy();

    return { id: event.id };
  },

  /**
   * Get all events in a date range without pagination (for calendar rendering)
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Array>} Events in the date range
   */
  getByDateRange: async (startDate, endDate) => {
    const { CalendarEvent, User, Contact, Company, Deal } = require('../models');

    const events = await CalendarEvent.findAll({
      where: {
        start_time: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        }
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ],
      order: [['start_time', 'ASC']]
    });

    return events;
  }
};

module.exports = calendarService;
