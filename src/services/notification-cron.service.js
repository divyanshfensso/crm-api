const cron = require('node-cron');
const { Op } = require('sequelize');

const setupNotificationCron = () => {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkTaskReminders();
      await checkCalendarReminders();
      await checkOverdueInvoices();
    } catch (error) {
      console.error('Notification cron error:', error.message);
    }
  });

  console.log('Notification cron jobs initialized (every 15 minutes).');
};

/**
 * Check for tasks due soon and send reminders
 */
const checkTaskReminders = async () => {
  try {
    const { Task, Setting, Notification } = require('../models');
    const { emitNotification } = require('../utils/notificationEmitter');

    // Get reminder window from settings (default 24 hours)
    const reminderSetting = await Setting.findOne({
      where: { setting_key: 'notification.reminder_hours' }
    });
    const reminderHours = parseInt(reminderSetting?.setting_value || '24', 10);

    const now = new Date();
    const reminderWindow = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);

    // Find tasks due within the window
    const tasks = await Task.findAll({
      where: {
        status: { [Op.in]: ['pending', 'in_progress'] },
        due_date: { [Op.gte]: now, [Op.lte]: reminderWindow },
        assigned_to: { [Op.not]: null }
      },
      limit: 50
    });

    for (const task of tasks) {
      // Dedup: check if reminder already sent
      const existing = await Notification.findOne({
        where: {
          type: 'task_due_soon',
          related_module: 'tasks',
          related_id: task.id,
          recipient_id: task.assigned_to
        }
      });

      if (!existing) {
        const hoursUntilDue = Math.round((new Date(task.due_date) - now) / (1000 * 60 * 60));
        await emitNotification('task_due_soon', task.assigned_to, {
          title: `Task due in ${hoursUntilDue} hour${hoursUntilDue !== 1 ? 's' : ''}`,
          message: `Your task "${task.title}" is due soon. Please complete it on time.`,
          related_module: 'tasks',
          related_id: task.id,
          priority: hoursUntilDue <= 6 ? 'high' : 'medium'
        });
      }
    }

    // Check for overdue tasks
    const overdueTasks = await Task.findAll({
      where: {
        status: { [Op.in]: ['pending', 'in_progress'] },
        due_date: { [Op.lt]: now },
        assigned_to: { [Op.not]: null }
      },
      limit: 50
    });

    for (const task of overdueTasks) {
      const existing = await Notification.findOne({
        where: {
          type: 'task_overdue',
          related_module: 'tasks',
          related_id: task.id,
          recipient_id: task.assigned_to
        }
      });

      if (!existing) {
        await emitNotification('task_overdue', task.assigned_to, {
          title: 'Task overdue',
          message: `Your task "${task.title}" is past its due date. Please update its status.`,
          related_module: 'tasks',
          related_id: task.id,
          priority: 'high'
        });
      }
    }
  } catch (error) {
    console.error('Task reminder cron error:', error.message);
  }
};

/**
 * Check for calendar events starting soon
 */
const checkCalendarReminders = async () => {
  try {
    const { CalendarEvent, Notification } = require('../models');
    const { emitNotification } = require('../utils/notificationEmitter');

    const now = new Date();
    const reminderWindow = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    const events = await CalendarEvent.findAll({
      where: {
        start_time: { [Op.gte]: now, [Op.lte]: reminderWindow }
      },
      limit: 50
    });

    for (const event of events) {
      // Notify the creator
      if (event.created_by) {
        const existing = await Notification.findOne({
          where: {
            type: 'calendar_reminder',
            related_module: 'calendar',
            related_id: event.id,
            recipient_id: event.created_by
          }
        });

        if (!existing) {
          await emitNotification('calendar_reminder', event.created_by, {
            title: 'Event starting soon',
            message: `"${event.title}" starts in 30 minutes.`,
            related_module: 'calendar',
            related_id: event.id,
            priority: 'high'
          });
        }
      }
    }
  } catch (error) {
    console.error('Calendar reminder cron error:', error.message);
  }
};

/**
 * Check for overdue invoices (escalation)
 */
const checkOverdueInvoices = async () => {
  try {
    const { Invoice, Setting, Notification } = require('../models');
    const { emitNotification } = require('../utils/notificationEmitter');

    // Check if escalation is enabled
    const escalationSetting = await Setting.findOne({
      where: { setting_key: 'notification.escalation_enabled' }
    });
    if (escalationSetting && escalationSetting.setting_value === 'false') {
      return;
    }

    const now = new Date();
    const overdueInvoices = await Invoice.findAll({
      where: {
        status: { [Op.in]: ['sent', 'overdue'] },
        due_date: { [Op.lt]: now }
      },
      limit: 50
    });

    for (const invoice of overdueInvoices) {
      if (!invoice.created_by) continue;

      const existing = await Notification.findOne({
        where: {
          type: 'invoice_overdue',
          related_module: 'invoices',
          related_id: invoice.id,
          recipient_id: invoice.created_by
        }
      });

      if (!existing) {
        const daysOverdue = Math.floor((now - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
        await emitNotification('invoice_overdue', invoice.created_by, {
          title: `Invoice ${invoice.invoice_number || '#' + invoice.id} is overdue`,
          message: `This invoice is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Please follow up with the client.`,
          related_module: 'invoices',
          related_id: invoice.id,
          priority: 'urgent'
        });
      }
    }
  } catch (error) {
    console.error('Invoice escalation cron error:', error.message);
  }
};

module.exports = { setupNotificationCron };
