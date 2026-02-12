const { Op } = require('sequelize');

/**
 * Generate iCalendar (.ics) file content for a calendar event
 * Follows RFC 5545 specification
 * @param {Object} event - Calendar event
 * @returns {string} ICS file content
 */
const generateICS = (event) => {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const escapeICS = (text) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const uid = `event-${event.id}-${Date.now()}@facilis-crm`;
  const now = formatDate(new Date().toISOString());
  const start = formatDate(event.start_time);
  const end = event.end_time ? formatDate(event.end_time) : start;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Facilis CRM//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];

  if (event.description) {
    ics.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  if (event.location) {
    ics.push(`LOCATION:${escapeICS(event.location)}`);
  }

  if (Array.isArray(event.attendees)) {
    event.attendees.forEach((attendee) => {
      if (attendee.email) {
        ics.push(
          `ATTENDEE;CN=${escapeICS(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`
        );
      }
    });
  }

  ics.push('STATUS:CONFIRMED');
  ics.push('END:VEVENT');
  ics.push('END:VCALENDAR');

  return ics.join('\r\n');
};

/**
 * Generate a Google Calendar event creation URL
 * @param {Object} event - Calendar event
 * @returns {string} Google Calendar URL
 */
const generateGoogleCalendarUrl = (event) => {
  const formatGCalDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const endTime = event.end_time || event.start_time;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || '',
    dates: `${formatGCalDate(event.start_time)}/${formatGCalDate(endTime)}`,
  });

  if (event.description) {
    params.set('details', event.description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Send calendar invitation emails to all attendees with email addresses
 * @param {Object} event - Full calendar event object (with attendees array)
 * @param {number} userId - ID of the user who created/updated the event
 * @param {boolean} isUpdate - Whether this is an update (vs new creation)
 * @returns {Promise<{sent: number, failed: number, skipped?: boolean}>}
 */
const sendEventInvitations = async (event, userId, isUpdate = false) => {
  const { Setting, EmailLog } = require('../models');

  // Fetch SMTP settings
  const smtpKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'];
  const smtpSettings = await Setting.findAll({
    where: { setting_key: { [Op.in]: smtpKeys } },
    raw: true,
  });

  const smtpConfig = {};
  for (const setting of smtpSettings) {
    smtpConfig[setting.setting_key] = setting.setting_value;
  }

  // If SMTP is not configured, silently skip
  for (const key of smtpKeys) {
    if (!smtpConfig[key]) {
      console.warn(`Calendar invitation skipped: SMTP setting '${key}' not configured.`);
      return { sent: 0, failed: 0, skipped: true };
    }
  }

  // Create nodemailer transporter
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtpConfig.smtp_host,
    port: parseInt(smtpConfig.smtp_port, 10),
    secure: parseInt(smtpConfig.smtp_port, 10) === 465,
    auth: {
      user: smtpConfig.smtp_user,
      pass: smtpConfig.smtp_pass,
    },
  });

  // Generate ICS and Google Calendar URL
  const icsContent = generateICS(event);
  const googleCalUrl = generateGoogleCalendarUrl(event);

  // Format date/time for email display
  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const subject = isUpdate
    ? `Updated: ${event.title}`
    : `Invitation: ${event.title}`;

  const htmlBody = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
      <div style="background: #0072BC; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${isUpdate ? 'Event Updated' : "You're Invited"}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #0072BC; font-size: 20px;">${event.title}</h3>
        ${event.description ? `<p style="margin: 0 0 12px; color: #555;">${event.description}</p>` : ''}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px 0; color: #707070; font-weight: 600; width: 100px;">When:</td>
            <td style="padding: 8px 0;">${formatDateTime(event.start_time)}${event.end_time ? ` - ${formatDateTime(event.end_time)}` : ''}</td>
          </tr>
          ${event.all_day ? '<tr><td style="padding: 8px 0; color: #707070; font-weight: 600;">Duration:</td><td style="padding: 8px 0;">All Day</td></tr>' : ''}
          ${event.location ? `<tr><td style="padding: 8px 0; color: #707070; font-weight: 600;">Where:</td><td style="padding: 8px 0;">${event.location}</td></tr>` : ''}
        </table>
        <div style="margin-top: 20px;">
          <a href="${googleCalUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #0072BC; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
            Add to Google Calendar
          </a>
        </div>
        <p style="margin-top: 16px; font-size: 12px; color: #999;">
          An .ics calendar file is attached. Open it to add this event to your calendar app (Outlook, Apple Calendar, etc.).
        </p>
      </div>
      <div style="margin-top: 16px; text-align: center; font-size: 11px; color: #aaa;">
        Sent from Facilis CRM
      </div>
    </div>
  `;

  // Send to each attendee with email
  const attendeesWithEmail = (event.attendees || []).filter((a) => a.email);
  let sent = 0;
  let failed = 0;

  for (const attendee of attendeesWithEmail) {
    try {
      const mailOptions = {
        from: smtpConfig.smtp_user,
        to: attendee.email,
        subject,
        html: htmlBody,
        alternatives: [
          {
            contentType: 'text/calendar; method=REQUEST',
            content: Buffer.from(icsContent),
          },
        ],
        attachments: [
          {
            filename: 'invite.ics',
            content: icsContent,
            contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      sent++;

      await EmailLog.create({
        template_id: null,
        recipient_email: attendee.email,
        recipient_name: attendee.name,
        subject,
        body: htmlBody,
        status: 'sent',
        sent_at: new Date(),
        sent_by: userId,
      });
    } catch (err) {
      failed++;
      console.error(`Failed to send invitation to ${attendee.email}:`, err.message);

      await EmailLog.create({
        template_id: null,
        recipient_email: attendee.email,
        recipient_name: attendee.name,
        subject,
        body: htmlBody,
        status: 'failed',
        error_message: err.message,
        sent_by: userId,
      });
    }
  }

  return { sent, failed };
};

module.exports = {
  generateICS,
  generateGoogleCalendarUrl,
  sendEventInvitations,
};
