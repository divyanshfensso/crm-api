const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const modelMap = {
  contacts: 'Contact',
  leads: 'Lead',
  deals: 'Deal',
  companies: 'Company',
  activities: 'Activity',
  tasks: 'Task',
  quotes: 'Quote',
  invoices: 'Invoice',
  payments: 'Payment'
};

/**
 * Build Sequelize where clause from report filter definitions
 * @param {Array} filters - Array of filter objects { field, operator, value }
 * @returns {Object} Sequelize where clause
 */
const buildWhereFromFilters = (filters) => {
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return {};
  }

  const where = {};

  filters.forEach((filter) => {
    const { field, operator, value } = filter;
    if (!field || !operator) return;

    switch (operator) {
      case 'equals':
        where[field] = { [Op.eq]: value };
        break;
      case 'not_equals':
        where[field] = { [Op.ne]: value };
        break;
      case 'contains':
        where[field] = { [Op.like]: `%${value}%` };
        break;
      case 'greater_than':
        where[field] = { [Op.gt]: value };
        break;
      case 'less_than':
        where[field] = { [Op.lt]: value };
        break;
      case 'in':
        where[field] = { [Op.in]: Array.isArray(value) ? value : [value] };
        break;
      default:
        break;
    }
  });

  return where;
};

const reportService = {
  /**
   * Get all reports with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated reports list
   */
  getAll: async (query) => {
    const { Report, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, entity_type, is_public } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name']);
      Object.assign(where, searchCondition);
    }

    // Filter by entity_type
    if (entity_type) {
      where.entity_type = entity_type;
    }

    // Filter by is_public
    if (is_public !== undefined && is_public !== '') {
      where.is_public = is_public === 'true' || is_public === true;
    }

    const { count, rows } = await Report.findAndCountAll({
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
        totalPages: Math.ceil(count / limit),
        hasNextPage: page < Math.ceil(count / limit),
        hasPrevPage: page > 1
      }
    };
  },

  /**
   * Get report by ID with creator details
   * @param {number} id - Report ID
   * @returns {Promise<Object>} Report with creator
   */
  getById: async (id) => {
    const { Report, User } = require('../models');

    const report = await Report.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    if (!report) {
      throw ApiError.notFound('Report not found');
    }

    return report;
  },

  /**
   * Create a new report
   * @param {Object} data - Report data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created report
   */
  create: async (data, userId) => {
    const { Report } = require('../models');

    const reportData = {
      ...data,
      created_by: userId
    };

    const report = await Report.create(reportData);

    return await reportService.getById(report.id);
  },

  /**
   * Update an existing report
   * @param {number} id - Report ID
   * @param {Object} data - Updated report data
   * @returns {Promise<Object>} Updated report
   */
  update: async (id, data) => {
    const { Report } = require('../models');

    const report = await Report.findByPk(id);

    if (!report) {
      throw ApiError.notFound('Report not found');
    }

    await report.update(data);

    return await reportService.getById(id);
  },

  /**
   * Soft delete a report
   * @param {number} id - Report ID
   * @returns {Promise<Object>} Deleted report info
   */
  delete: async (id) => {
    const { Report } = require('../models');

    const report = await Report.findByPk(id);

    if (!report) {
      throw ApiError.notFound('Report not found');
    }

    await report.destroy();

    return { id: report.id };
  },

  /**
   * Execute a report with dynamic query building
   * @param {number} id - Report ID
   * @param {Object} params - Execution parameters (page, limit)
   * @returns {Promise<Object>} Paginated query results
   */
  executeReport: async (id, params) => {
    const db = require('../models');

    const report = await reportService.getById(id);

    const Model = db[modelMap[report.entity_type]];
    if (!Model) {
      throw ApiError.badRequest(`Unsupported entity type: ${report.entity_type}`);
    }

    // Build query options
    const queryOptions = {};

    // Build attributes from report.columns
    if (report.columns && Array.isArray(report.columns) && report.columns.length > 0) {
      queryOptions.attributes = report.columns;
    }

    // Build where from report.filters
    const where = buildWhereFromFilters(report.filters);
    if (Object.keys(where).length > 0) {
      queryOptions.where = where;
    }

    // Build order from report.sorting
    if (report.sorting && Array.isArray(report.sorting) && report.sorting.length > 0) {
      queryOptions.order = report.sorting.map((sort) => [
        sort.field,
        (sort.direction || 'ASC').toUpperCase()
      ]);
    }

    // Build group from report.grouping
    if (report.grouping && Array.isArray(report.grouping) && report.grouping.length > 0) {
      queryOptions.group = report.grouping;
    }

    // Apply pagination from params
    const { page, limit, offset } = getPagination(params || {});
    queryOptions.limit = limit;
    queryOptions.offset = offset;

    const { count, rows } = await Model.findAndCountAll(queryOptions);

    // count may be an array when grouping is used
    const total = Array.isArray(count) ? count.length : count;

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  },

  /**
   * Export a report as CSV or JSON
   * @param {number} id - Report ID
   * @param {string} format - Export format ('csv' or 'json')
   * @param {Object} params - Execution parameters
   * @returns {Promise<Buffer>} Exported data as buffer
   */
  exportReport: async (id, format, params) => {
    // Execute report with high limit to get all data
    const exportParams = { ...params, limit: 10000, page: 1 };
    const result = await reportService.executeReport(id, exportParams);

    const rows = result.data.map((row) =>
      row.toJSON ? row.toJSON() : row
    );

    if (format === 'csv') {
      const { stringify } = require('csv-stringify/sync');
      const csvData = stringify(rows, { header: true });
      return Buffer.from(csvData, 'utf-8');
    }

    // Default to JSON
    const jsonData = JSON.stringify(rows, null, 2);
    return Buffer.from(jsonData, 'utf-8');
  }
};

module.exports = reportService;
