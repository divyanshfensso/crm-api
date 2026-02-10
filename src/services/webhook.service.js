const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const webhookService = {
  /**
   * Get all webhooks with pagination and search
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated webhooks list
   */
  getAll: async (query) => {
    const { Webhook, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name', 'url']);
      Object.assign(where, searchCondition);
    }

    const { count, rows } = await Webhook.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
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
   * Get webhook by ID with creator info
   * @param {number} id - Webhook ID
   * @returns {Promise<Object>} Webhook details
   */
  getById: async (id) => {
    const { Webhook, User } = require('../models');

    const webhook = await Webhook.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    return webhook;
  },

  /**
   * Create a new webhook
   * @param {Object} data - Webhook data (name, url, events)
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created webhook
   */
  create: async (data, userId) => {
    const crypto = require('crypto');
    const { Webhook } = require('../models');

    // Generate random secret for HMAC signing
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await Webhook.create({
      name: data.name,
      url: data.url,
      events: data.events,
      secret,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: userId
    });

    return await webhookService.getById(webhook.id);
  },

  /**
   * Update an existing webhook
   * @param {number} id - Webhook ID
   * @param {Object} data - Updated webhook data
   * @returns {Promise<Object>} Updated webhook
   */
  update: async (id, data) => {
    const { Webhook } = require('../models');

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    // Do NOT allow changing the secret
    const { secret, ...updateData } = data;

    await webhook.update(updateData);

    return await webhookService.getById(id);
  },

  /**
   * Soft delete a webhook
   * @param {number} id - Webhook ID
   * @returns {Promise<Object>} Deleted webhook info
   */
  delete: async (id) => {
    const { Webhook } = require('../models');

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    await webhook.destroy();

    return { id: webhook.id };
  },

  /**
   * Trigger webhooks for a specific event
   * @param {string} event - Event name (e.g. 'contact.created')
   * @param {Object} payload - Event payload
   * @returns {Promise<void>}
   */
  trigger: async (event, payload) => {
    const crypto = require('crypto');
    const axios = require('axios');
    const { Webhook, WebhookDelivery } = require('../models');

    // Find all active webhooks
    const webhooks = await Webhook.findAll({
      where: { is_active: true }
    });

    // Filter webhooks that subscribe to this event
    const matchingWebhooks = webhooks.filter(w => w.events && w.events.includes(event));

    for (const webhook of matchingWebhooks) {
      // Create HMAC signature
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Create delivery record with pending status
      const delivery = await WebhookDelivery.create({
        webhook_id: webhook.id,
        event,
        payload,
        status: 'pending',
        attempts: 1
      });

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event
      };

      try {
        const response = await axios.post(webhook.url, payload, {
          headers,
          timeout: 10000
        });

        // Update delivery on success
        await delivery.update({
          status: 'success',
          status_code: response.status,
          response_body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        });
      } catch (error) {
        // Update delivery on failure
        await delivery.update({
          status: 'failed',
          status_code: error.response ? error.response.status : null,
          error_message: error.message,
          attempts: delivery.attempts + 1
        });
      }
    }
  },

  /**
   * Get deliveries for a specific webhook
   * @param {number} webhookId - Webhook ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated deliveries list
   */
  getDeliveries: async (webhookId, query) => {
    const { WebhookDelivery } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const order = getSorting(query, 'created_at', 'DESC');

    const { count, rows } = await WebhookDelivery.findAndCountAll({
      where: { webhook_id: webhookId },
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
   * Retry a failed webhook delivery
   * @param {number} deliveryId - Delivery ID
   * @returns {Promise<Object>} Updated delivery
   */
  retryDelivery: async (deliveryId) => {
    const crypto = require('crypto');
    const axios = require('axios');
    const { WebhookDelivery, Webhook } = require('../models');

    const delivery = await WebhookDelivery.findByPk(deliveryId, {
      include: [
        {
          model: Webhook,
          as: 'webhook'
        }
      ]
    });

    if (!delivery) {
      throw ApiError.notFound('Webhook delivery not found');
    }

    const webhook = delivery.webhook;

    if (!webhook) {
      throw ApiError.notFound('Associated webhook not found');
    }

    // Create HMAC signature with the same payload
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(delivery.payload))
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': delivery.event
    };

    try {
      const response = await axios.post(webhook.url, delivery.payload, {
        headers,
        timeout: 10000
      });

      await delivery.update({
        status: 'success',
        status_code: response.status,
        response_body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        error_message: null,
        attempts: delivery.attempts + 1
      });
    } catch (error) {
      await delivery.update({
        status: 'failed',
        status_code: error.response ? error.response.status : null,
        error_message: error.message,
        attempts: delivery.attempts + 1
      });
    }

    // Re-fetch to get updated data
    return await WebhookDelivery.findByPk(deliveryId);
  },

  /**
   * Send a test delivery to a webhook
   * @param {number} webhookId - Webhook ID
   * @returns {Promise<Object>} Test delivery result
   */
  test: async (webhookId) => {
    const webhook = await webhookService.getById(webhookId);

    const testPayload = {
      event: 'test',
      data: { message: 'This is a test webhook delivery' },
      timestamp: new Date().toISOString()
    };

    await webhookService.trigger('test', testPayload);

    return { webhook_id: webhookId, payload: testPayload };
  }
};

module.exports = webhookService;
