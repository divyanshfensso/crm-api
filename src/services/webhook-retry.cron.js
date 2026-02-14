const cron = require('node-cron');
const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');

/**
 * Webhook auto-retry cron job
 * Runs every 5 minutes, retries failed webhook deliveries with exponential backoff
 */
const setupWebhookRetryCron = () => {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { WebhookDelivery, Webhook } = require('../models');

      // Find failed deliveries that are due for retry
      const deliveries = await WebhookDelivery.findAll({
        where: {
          status: 'failed',
          next_retry_at: { [Op.lte]: new Date() },
          attempts: { [Op.lt]: 5 },
        },
        include: [{ model: Webhook, as: 'webhook' }],
        limit: 50, // Prevent storms
        order: [['next_retry_at', 'ASC']],
      });

      if (deliveries.length === 0) return;

      console.log(`[Webhook Retry] Processing ${deliveries.length} failed deliveries`);

      for (const delivery of deliveries) {
        const webhook = delivery.webhook;
        if (!webhook || webhook.deleted_at) {
          // Webhook was deleted, stop retrying
          await delivery.update({ next_retry_at: null });
          continue;
        }

        try {
          // Rebuild payload from stored data
          const payload = JSON.parse(delivery.payload || '{}');
          const signature = crypto
            .createHmac('sha256', webhook.secret || '')
            .update(JSON.stringify(payload))
            .digest('hex');

          const headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': delivery.event,
            'X-Webhook-Retry': String(delivery.attempts),
          };

          const response = await axios.post(webhook.url, payload, {
            headers,
            timeout: 10000,
          });

          // Success
          await delivery.update({
            status: 'success',
            status_code: response.status,
            response_body: typeof response.data === 'string'
              ? response.data
              : JSON.stringify(response.data),
            next_retry_at: null,
          });

          console.log(`[Webhook Retry] Delivery ${delivery.id} succeeded on attempt ${delivery.attempts + 1}`);
        } catch (error) {
          const newAttempts = delivery.attempts + 1;
          const nextRetryAt = newAttempts < 5
            ? new Date(Date.now() + Math.pow(2, newAttempts) * 60 * 1000)
            : null;

          await delivery.update({
            status: 'failed',
            status_code: error.response ? error.response.status : null,
            error_message: error.message,
            attempts: newAttempts,
            next_retry_at: nextRetryAt,
          });

          if (!nextRetryAt) {
            console.log(`[Webhook Retry] Delivery ${delivery.id} gave up after ${newAttempts} attempts`);
          }
        }
      }
    } catch (error) {
      console.error('[Webhook Retry] Cron error:', error.message);
    }
  });

  console.log('Webhook auto-retry cron initialized (every 5 minutes)');
};

module.exports = { setupWebhookRetryCron };
