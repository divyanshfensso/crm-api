const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting } = require('../utils/pagination');

const notificationService = {
  /**
   * Get all notifications for a user with pagination
   */
  getAll: async (userId, query) => {
    const { Notification, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const order = getSorting(query, 'created_at', 'DESC');

    const where = { recipient_id: userId };

    if (query.is_read !== undefined) {
      where.is_read = query.is_read === 'true' || query.is_read === true;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.priority) {
      where.priority = query.priority;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order,
      limit,
      offset,
      distinct: true
    });

    return {
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
    };
  },

  /**
   * Get unread count for a user
   */
  getUnreadCount: async (userId) => {
    const { Notification } = require('../models');
    return await Notification.count({
      where: { recipient_id: userId, is_read: false }
    });
  },

  /**
   * Get notification by ID (own only)
   */
  getById: async (id, userId) => {
    const { Notification, User } = require('../models');

    const notification = await Notification.findByPk(id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'recipient', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }
    if (notification.recipient_id !== userId) {
      throw ApiError.forbidden('You can only view your own notifications');
    }

    return notification;
  },

  /**
   * Create a notification
   */
  create: async (data) => {
    const { Notification } = require('../models');

    return await Notification.create({
      type: data.type,
      title: data.title,
      message: data.message,
      recipient_id: data.recipient_id,
      sender_id: data.sender_id || null,
      related_module: data.related_module || null,
      related_id: data.related_id || null,
      priority: data.priority || 'medium',
      data: data.data || null,
      is_email_sent: false
    });
  },

  /**
   * Create notification and optionally send email for high priority
   */
  createAndNotify: async (data, sendEmail = null) => {
    const notification = await notificationService.create(data);

    // Check if email notifications are enabled
    const { Setting } = require('../models');
    const emailSetting = await Setting.findOne({
      where: { setting_key: 'notification.email_enabled' }
    });
    const emailEnabled = emailSetting ? emailSetting.setting_value !== 'false' : true;

    // Determine if email should be sent
    const shouldSendEmail = sendEmail !== null
      ? sendEmail
      : (emailEnabled && (data.priority === 'high' || data.priority === 'urgent'));

    if (shouldSendEmail) {
      try {
        const emailService = require('./notification-email.service');
        await emailService.sendNotificationEmail(notification.id);
        await notification.update({ is_email_sent: true });
      } catch (error) {
        console.error('Failed to send notification email:', error.message);
      }
    }

    return notification;
  },

  /**
   * Bulk create notifications for multiple recipients
   */
  bulkCreate: async (recipientIds, notificationData) => {
    const { Notification } = require('../models');

    const records = recipientIds.map(recipientId => ({
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      recipient_id: recipientId,
      sender_id: notificationData.sender_id || null,
      related_module: notificationData.related_module || null,
      related_id: notificationData.related_id || null,
      priority: notificationData.priority || 'medium',
      data: notificationData.data || null,
      is_email_sent: false
    }));

    return await Notification.bulkCreate(records);
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (id, userId) => {
    const notification = await notificationService.getById(id, userId);
    if (notification.is_read) return notification;

    await notification.update({ is_read: true, read_at: new Date() });
    return notification;
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: async (userId) => {
    const { Notification } = require('../models');
    const [updatedCount] = await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { recipient_id: userId, is_read: false } }
    );
    return updatedCount;
  },

  /**
   * Delete a notification (own only)
   */
  delete: async (id, userId) => {
    const notification = await notificationService.getById(id, userId);
    await notification.destroy();
    return { id: notification.id };
  },

  /**
   * Delete all read notifications for a user
   */
  deleteRead: async (userId) => {
    const { Notification } = require('../models');
    return await Notification.destroy({
      where: { recipient_id: userId, is_read: true }
    });
  }
};

module.exports = notificationService;
