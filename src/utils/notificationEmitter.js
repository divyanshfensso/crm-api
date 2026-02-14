/**
 * Emit notification — creates notification and optionally sends email
 * @param {string} type - Notification type
 * @param {number} recipientId - User ID of recipient
 * @param {Object} payload - { title, message, sender_id, related_module, related_id, priority, data }
 */
const emitNotification = async (type, recipientId, payload) => {
  try {
    const notificationService = require('../services/notification.service');

    await notificationService.createAndNotify({
      type,
      recipient_id: recipientId,
      title: payload.title,
      message: payload.message,
      sender_id: payload.sender_id || null,
      related_module: payload.related_module || null,
      related_id: payload.related_id || null,
      priority: payload.priority || 'medium',
      data: payload.data || null
    });
  } catch (error) {
    console.error('Notification emission error:', error.message);
  }
};

/**
 * Emit notification to multiple recipients
 * @param {string} type - Notification type
 * @param {Array<number>} recipientIds - Array of user IDs
 * @param {Object} payload - Notification payload
 */
const emitNotificationBulk = async (type, recipientIds, payload) => {
  try {
    const notificationService = require('../services/notification.service');

    await notificationService.bulkCreate(recipientIds, {
      type,
      title: payload.title,
      message: payload.message,
      sender_id: payload.sender_id || null,
      related_module: payload.related_module || null,
      related_id: payload.related_id || null,
      priority: payload.priority || 'medium',
      data: payload.data || null
    });
  } catch (error) {
    console.error('Bulk notification emission error:', error.message);
  }
};

module.exports = { emitNotification, emitNotificationBulk };
