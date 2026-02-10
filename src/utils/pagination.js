/**
 * Extract and calculate pagination parameters from query
 * @param {Object} query - Request query object
 * @returns {Object} Pagination parameters { page, limit, offset }
 */
const getPagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset
  };
};

/**
 * Format paginated data for response
 * @param {Object} data - Sequelize findAndCountAll result
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Formatted pagination data
 */
const formatPaginatedData = (data, page, limit) => {
  const { count: total, rows } = data;
  const totalPages = Math.ceil(total / limit);

  return {
    items: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Get sorting parameters from query
 * @param {Object} query - Request query object
 * @param {string} defaultSortBy - Default sort field
 * @param {string} defaultSortOrder - Default sort order ('ASC' or 'DESC')
 * @returns {Array} Sequelize order array
 */
const getSorting = (query = {}, defaultSortBy = 'createdAt', defaultSortOrder = 'DESC') => {
  const sortBy = query.sortBy || defaultSortBy;
  const sortOrder = (query.sortOrder || defaultSortOrder).toUpperCase();

  // Validate sort order
  const validSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

  return [[sortBy, validSortOrder]];
};

/**
 * Build search conditions for Sequelize
 * @param {string} search - Search query string
 * @param {Array} fields - Fields to search in
 * @returns {Object} Sequelize where condition with Op.or
 */
const buildSearchCondition = (search, fields = []) => {
  const { Op } = require('sequelize');

  if (!search || !fields.length) {
    return {};
  }

  const searchConditions = fields.map(field => ({
    [field]: {
      [Op.like]: `%${search}%`
    }
  }));

  return {
    [Op.or]: searchConditions
  };
};

module.exports = {
  getPagination,
  formatPaginatedData,
  getSorting,
  buildSearchCondition
};
