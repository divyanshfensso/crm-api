const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

/**
 * Replace {{variable}} placeholders in text with provided values
 */
const replaceVariables = (text, variables) => {
  if (!text || !variables) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
};

const emailTemplateService = {
  /**
   * Get all email templates with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated email templates list
   */
  getAll: async (query) => {
    const { EmailTemplate, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, module, is_active } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name', 'subject']);
      Object.assign(where, searchCondition);
    }

    // Filter by module
    if (module) {
      where.module = module;
    }

    // Filter by is_active
    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }

    const { count, rows } = await EmailTemplate.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
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
   * Get email template by ID with full details
   * @param {number} id - Email template ID
   * @returns {Promise<Object>} Email template with relations
   */
  getById: async (id) => {
    const { EmailTemplate, User } = require('../models');

    const template = await EmailTemplate.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    return template;
  },

  /**
   * Create a new email template
   * @param {Object} data - Email template data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created email template
   */
  create: async (data, userId) => {
    const { EmailTemplate } = require('../models');

    const templateData = {
      name: data.name,
      subject: data.subject,
      body_html: data.body_html,
      body_text: data.body_text || null,
      module: data.module || 'general',
      variables: data.variables || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: userId
    };

    const template = await EmailTemplate.create(templateData);

    // Fetch the created template with relations
    return await emailTemplateService.getById(template.id);
  },

  /**
   * Update an existing email template
   * @param {number} id - Email template ID
   * @param {Object} data - Updated email template data
   * @returns {Promise<Object>} Updated email template
   */
  update: async (id, data) => {
    const { EmailTemplate } = require('../models');

    const template = await EmailTemplate.findByPk(id);

    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    await template.update(data);

    // Fetch the updated template with relations
    return await emailTemplateService.getById(id);
  },

  /**
   * Soft delete an email template
   * @param {number} id - Email template ID
   * @returns {Promise<Object>} Deleted email template
   */
  delete: async (id) => {
    const { EmailTemplate } = require('../models');

    const template = await EmailTemplate.findByPk(id);

    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    await template.destroy();

    return { id: template.id };
  },

  /**
   * Send an email using a template
   * @param {number} templateId - Email template ID
   * @param {Object} data - Send data (recipient_email, recipient_name, cc, variables)
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Send result with email log
   */
  sendEmail: async (templateId, data, userId) => {
    const { EmailTemplate, Setting, EmailLog } = require('../models');
    const { recipient_email, recipient_name, cc, variables } = data;

    if (!recipient_email) {
      throw ApiError.badRequest('Recipient email is required');
    }

    // Fetch template
    const template = await EmailTemplate.findByPk(templateId);
    if (!template) {
      throw ApiError.notFound('Email template not found');
    }
    if (!template.is_active) {
      throw ApiError.badRequest('Cannot send from an inactive template');
    }

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

    // Validate SMTP configuration
    for (const key of smtpKeys) {
      if (!smtpConfig[key]) {
        throw ApiError.badRequest(`SMTP setting '${key}' is not configured. Please configure email settings first.`);
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

    // Replace variables in subject and body
    const mergedSubject = replaceVariables(template.subject, variables);
    const mergedBody = replaceVariables(template.body_html, variables);

    // Build mail options
    const mailOptions = {
      from: smtpConfig.smtp_user,
      to: recipient_email,
      subject: mergedSubject,
      html: mergedBody,
    };

    if (cc) {
      mailOptions.cc = cc;
    }

    // Send email and create log
    try {
      await transporter.sendMail(mailOptions);

      const emailLog = await EmailLog.create({
        template_id: templateId,
        recipient_email,
        recipient_name: recipient_name || null,
        subject: mergedSubject,
        body: mergedBody,
        status: 'sent',
        sent_at: new Date(),
        sent_by: userId,
      });

      return { emailLog };
    } catch (err) {
      // Log the failed attempt
      const emailLog = await EmailLog.create({
        template_id: templateId,
        recipient_email,
        recipient_name: recipient_name || null,
        subject: mergedSubject,
        body: mergedBody,
        status: 'failed',
        error_message: err.message,
        sent_by: userId,
      });

      throw ApiError.internal(`Failed to send email: ${err.message}`);
    }
  }
};

module.exports = emailTemplateService;
