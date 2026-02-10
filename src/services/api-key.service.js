const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const apiKeyService = {
  /**
   * Generate a new API key
   * @param {Object} data - API key data (name, scopes, rate_limit, expires_at)
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created API key with raw key (shown once)
   */
  generate: async (data, userId) => {
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const { ApiKey } = require('../models');

    // Generate random key with prefix
    const rawKey = 'fc_' + crypto.randomBytes(32).toString('hex');

    // Hash the key for storage
    const key_hash = await bcrypt.hash(rawKey, 12);

    // Store prefix for lookup
    const key_prefix = rawKey.substring(0, 10);

    const apiKey = await ApiKey.create({
      name: data.name,
      key_hash,
      key_prefix,
      user_id: userId,
      scopes: data.scopes,
      rate_limit: data.rate_limit,
      expires_at: data.expires_at,
      created_by: userId
    });

    // Return with raw key - this is shown ONCE only
    return { ...apiKey.toJSON(), raw_key: rawKey };
  },

  /**
   * Get all API keys with pagination
   * @param {Object} query - Query parameters
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Paginated API keys list (without key_hash)
   */
  getAll: async (query, userId) => {
    const { ApiKey, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const order = getSorting(query, 'created_at', 'DESC');

    const where = { user_id: userId };

    const { count, rows } = await ApiKey.findAndCountAll({
      where,
      attributes: { exclude: ['key_hash'] },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
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
   * Get API key by ID (without key_hash)
   * @param {number} id - API key ID
   * @returns {Promise<Object>} API key details
   */
  getById: async (id) => {
    const { ApiKey, User } = require('../models');

    const apiKey = await ApiKey.findByPk(id, {
      attributes: { exclude: ['key_hash'] },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!apiKey) {
      throw ApiError.notFound('API key not found');
    }

    return apiKey;
  },

  /**
   * Revoke an API key
   * @param {number} id - API key ID
   * @returns {Promise<Object>} Updated API key
   */
  revoke: async (id) => {
    const { ApiKey } = require('../models');

    const apiKey = await ApiKey.findByPk(id);

    if (!apiKey) {
      throw ApiError.notFound('API key not found');
    }

    await apiKey.update({ is_active: false });

    return await apiKeyService.getById(id);
  },

  /**
   * Soft delete an API key
   * @param {number} id - API key ID
   * @returns {Promise<Object>} Deleted API key info
   */
  delete: async (id) => {
    const { ApiKey } = require('../models');

    const apiKey = await ApiKey.findByPk(id);

    if (!apiKey) {
      throw ApiError.notFound('API key not found');
    }

    await apiKey.destroy();

    return { id: apiKey.id };
  },

  /**
   * Verify a plain API key
   * @param {string} plainKey - The raw API key to verify
   * @returns {Promise<Object|null>} Verification result or null if invalid
   */
  verifyKey: async (plainKey) => {
    const bcrypt = require('bcryptjs');
    const { ApiKey } = require('../models');

    // Extract prefix for lookup
    const prefix = plainKey.substring(0, 10);

    // Find active keys matching the prefix
    const apiKeys = await ApiKey.findAll({
      where: {
        key_prefix: prefix,
        is_active: true
      }
    });

    // Compare against each matching key
    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(plainKey, apiKey.key_hash);

      if (isMatch) {
        // Check if expired
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
          return null;
        }

        // Update last_used_at
        await apiKey.update({ last_used_at: new Date() });

        return {
          user_id: apiKey.user_id,
          scopes: apiKey.scopes,
          apiKeyId: apiKey.id
        };
      }
    }

    return null;
  },

  /**
   * Get API logs for a specific API key
   * @param {number} apiKeyId - API key ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated API logs list
   */
  getLogs: async (apiKeyId, query) => {
    const { ApiLog } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const order = getSorting(query, 'created_at', 'DESC');

    const { count, rows } = await ApiLog.findAndCountAll({
      where: { api_key_id: apiKeyId },
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
   * Log an API request
   * @param {number} apiKeyId - API key ID
   * @param {string} method - HTTP method
   * @param {string} endpoint - Request endpoint
   * @param {number} statusCode - Response status code
   * @param {number} responseTime - Response time in ms
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Created log entry
   */
  logRequest: async (apiKeyId, method, endpoint, statusCode, responseTime, req) => {
    const { ApiLog } = require('../models');

    const ipAddress = req
      ? req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection?.remoteAddress || 'unknown'
      : null;
    const userAgent = req ? req.get('user-agent') || null : null;

    return await ApiLog.create({
      api_key_id: apiKeyId,
      method,
      endpoint,
      status_code: statusCode,
      response_time: responseTime,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }
};

module.exports = apiKeyService;
