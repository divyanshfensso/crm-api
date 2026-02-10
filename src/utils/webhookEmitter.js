const emitWebhook = async (event, payload) => {
  try {
    const webhookService = require('../services/webhook.service');
    await webhookService.trigger(event, payload);
  } catch (error) {
    console.error('Webhook emission error:', error.message);
  }
};

module.exports = { emitWebhook };
