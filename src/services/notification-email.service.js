const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');

/**
 * Build branded HTML email for a notification
 */
const buildNotificationEmail = (notification, companyName, logoUrl) => {
  const typeLabels = {
    task_assigned: 'Task Assigned',
    task_due_soon: 'Task Due Soon',
    task_overdue: 'Task Overdue',
    deal_stage_changed: 'Deal Updated',
    deal_won: 'Deal Won',
    deal_lost: 'Deal Lost',
    lead_assigned: 'Lead Assigned',
    calendar_reminder: 'Calendar Reminder',
    invoice_overdue: 'Invoice Overdue',
    mention: 'You Were Mentioned',
    system: 'System Notification'
  };

  const priorityColors = {
    low: '#3B82F6',
    medium: '#F59E0B',
    high: '#F97316',
    urgent: '#EF4444'
  };

  const typeLabel = typeLabels[notification.type] || 'Notification';
  const priorityColor = priorityColors[notification.priority] || '#3B82F6';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} - ${companyName}</title>
</head>
<body style="margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#F5F7FA;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7FA;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0072BC 0%,#005A96 100%);padding:28px 32px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:40px;margin-bottom:8px;">` : ''}
              <div style="color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${companyName}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="display:inline-block;padding:4px 14px;border-radius:12px;font-size:12px;font-weight:600;color:#FFFFFF;background-color:${priorityColor};margin-bottom:12px;">${notification.priority.toUpperCase()}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;">
                    <div style="color:#707070;font-size:13px;margin-bottom:6px;font-weight:500;">${typeLabel}</div>
                    <h2 style="font-size:20px;font-weight:600;color:#1F2937;margin:0 0 16px 0;line-height:1.3;">${notification.title}</h2>
                    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 28px 0;">${notification.message}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href="${clientUrl}" style="display:inline-block;padding:12px 28px;background-color:#0072BC;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Facilis CRM</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
              <p style="margin:0;color:#9CA3AF;font-size:13px;">This is an automated notification from ${companyName}.</p>
              <p style="margin:8px 0 0;color:#9CA3AF;font-size:12px;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const notificationEmailService = {
  /**
   * Send branded notification email
   * @param {number} notificationId - Notification ID
   */
  sendNotificationEmail: async (notificationId) => {
    const { Notification, User, Setting } = require('../models');

    const notification = await Notification.findByPk(notificationId, {
      include: [
        { model: User, as: 'recipient', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    const recipient = notification.recipient;
    if (!recipient || !recipient.email) {
      throw ApiError.badRequest('Recipient email not found');
    }

    // Fetch SMTP settings from DB with .env fallback
    const smtpKeys = ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password', 'smtp.from_email', 'smtp.from_name'];
    const settingsData = await Setting.findAll({
      where: { setting_key: { [Op.in]: smtpKeys } },
      raw: true
    });

    const settings = {};
    for (const s of settingsData) {
      settings[s.setting_key] = s.setting_value;
    }

    const smtpHost = settings['smtp.host'] || process.env.SMTP_HOST;
    const smtpPort = settings['smtp.port'] || process.env.SMTP_PORT || '587';
    const smtpUser = settings['smtp.user'] || process.env.SMTP_USER;
    const smtpPass = settings['smtp.password'] || process.env.SMTP_PASS;
    const fromEmail = settings['smtp.from_email'] || process.env.SMTP_FROM_EMAIL;
    const fromName = settings['smtp.from_name'] || process.env.SMTP_FROM_NAME || 'Facilis CRM';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('SMTP not configured — skipping notification email');
      return { success: false, reason: 'smtp_not_configured' };
    }

    // Fetch company settings for branding
    const companySettings = await Setting.findAll({
      where: { setting_key: { [Op.in]: ['company.name', 'company.logo_url'] } },
      raw: true
    });

    const companyName = companySettings.find(s => s.setting_key === 'company.name')?.setting_value || 'Facilis CRM';
    const logoUrl = companySettings.find(s => s.setting_key === 'company.logo_url')?.setting_value || '';

    // Build email
    const html = buildNotificationEmail(notification, companyName, logoUrl);

    // Send via nodemailer
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: parseInt(smtpPort, 10) === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail || smtpUser}>`,
      to: recipient.email,
      subject: notification.title,
      html
    });

    return { success: true, recipient: recipient.email };
  }
};

module.exports = notificationEmailService;
