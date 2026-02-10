const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields } = require('../utils/helpers');

const emailCampaignService = {
  /**
   * Get all email campaigns with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated email campaigns list
   */
  getAll: async (query) => {
    const { EmailCampaign, EmailTemplate, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name', 'subject']);
      Object.assign(where, searchCondition);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const { count, rows } = await EmailCampaign.findAndCountAll({
      where,
      include: [
        {
          model: EmailTemplate,
          as: 'template',
          attributes: ['id', 'name', 'subject']
        },
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
   * Get email campaign by ID with full details
   * @param {number} id - Campaign ID
   * @returns {Promise<Object>} Campaign with template, creator, and recipient count
   */
  getById: async (id) => {
    const { EmailCampaign, EmailTemplate, User, EmailCampaignRecipient, sequelize } = require('../models');

    const campaign = await EmailCampaign.findByPk(id, {
      include: [
        {
          model: EmailTemplate,
          as: 'template',
          attributes: ['id', 'name', 'subject', 'body_html', 'variables']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: EmailCampaignRecipient,
          as: 'recipients',
          attributes: []
        }
      ],
      attributes: {
        include: [
          [sequelize.fn('COUNT', sequelize.col('recipients.id')), 'recipients_count']
        ]
      },
      group: ['EmailCampaign.id', 'template.id', 'creator.id']
    });

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    return campaign;
  },

  /**
   * Create a new email campaign
   * @param {Object} data - Campaign data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created campaign
   */
  create: async (data, userId) => {
    const { EmailCampaign } = require('../models');

    const cleanData = sanitizeFKFields(data, ['template_id']);
    const campaignData = {
      ...cleanData,
      created_by: userId
    };

    const campaign = await EmailCampaign.create(campaignData);

    return await emailCampaignService.getById(campaign.id);
  },

  /**
   * Update an existing email campaign (only if status is 'draft')
   * @param {number} id - Campaign ID
   * @param {Object} data - Updated campaign data
   * @returns {Promise<Object>} Updated campaign
   */
  update: async (id, data) => {
    const { EmailCampaign } = require('../models');

    const campaign = await EmailCampaign.findByPk(id);

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    if (campaign.status !== 'draft') {
      throw ApiError.badRequest('Only draft campaigns can be updated');
    }

    const cleanData = sanitizeFKFields(data, ['template_id']);
    await campaign.update(cleanData);

    return await emailCampaignService.getById(id);
  },

  /**
   * Soft delete an email campaign (only if status is 'draft')
   * @param {number} id - Campaign ID
   * @returns {Promise<Object>} Deleted campaign info
   */
  delete: async (id) => {
    const { EmailCampaign } = require('../models');

    const campaign = await EmailCampaign.findByPk(id);

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    if (campaign.status !== 'draft') {
      throw ApiError.badRequest('Only draft campaigns can be deleted');
    }

    await campaign.destroy();

    return { id: campaign.id };
  },

  /**
   * Build audience for a campaign based on audience_filter
   * @param {number} campaignId - Campaign ID
   * @returns {Promise<number>} Number of recipients created
   */
  buildAudience: async (campaignId) => {
    const { EmailCampaign, EmailCampaignRecipient, Contact, Lead } = require('../models');

    const campaign = await EmailCampaign.findByPk(campaignId);

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    const audienceFilter = campaign.audience_filter;

    if (!audienceFilter || !audienceFilter.entity || !audienceFilter.conditions) {
      throw ApiError.badRequest('Campaign audience filter is not configured. Expected format: { entity, conditions: [{ field, operator, value }] }');
    }

    const { entity, conditions } = audienceFilter;

    // Build Sequelize WHERE clause from conditions
    const where = {};
    for (const condition of conditions) {
      const { field, operator, value } = condition;

      switch (operator) {
        case 'equals':
          where[field] = value;
          break;
        case 'not_equals':
          where[field] = { [Op.ne]: value };
          break;
        case 'contains':
          where[field] = { [Op.like]: `%${value}%` };
          break;
        case 'starts_with':
          where[field] = { [Op.like]: `${value}%` };
          break;
        case 'ends_with':
          where[field] = { [Op.like]: `%${value}` };
          break;
        case 'greater_than':
          where[field] = { [Op.gt]: value };
          break;
        case 'less_than':
          where[field] = { [Op.lt]: value };
          break;
        case 'in':
          where[field] = { [Op.in]: Array.isArray(value) ? value : [value] };
          break;
        default:
          where[field] = value;
      }
    }

    // Query matching entities
    let entities;
    if (entity === 'contacts') {
      entities = await Contact.findAll({
        where: { ...where, email: { [Op.ne]: null } },
        attributes: ['id', 'email'],
        raw: true
      });
    } else if (entity === 'leads') {
      entities = await Lead.findAll({
        where: { ...where, email: { [Op.ne]: null } },
        attributes: ['id', 'email'],
        raw: true
      });
    } else {
      throw ApiError.badRequest(`Unsupported audience entity: ${entity}. Supported: contacts, leads`);
    }

    // Remove existing recipients for this campaign before rebuilding
    await EmailCampaignRecipient.destroy({
      where: { campaign_id: campaignId },
      force: true
    });

    // Create recipient records
    const recipientRecords = entities.map((e) => ({
      campaign_id: campaignId,
      email: e.email,
      entity_type: entity,
      entity_id: e.id,
      status: 'pending'
    }));

    if (recipientRecords.length > 0) {
      await EmailCampaignRecipient.bulkCreate(recipientRecords);
    }

    // Update campaign total_recipients
    await campaign.update({ total_recipients: recipientRecords.length });

    return recipientRecords.length;
  },

  /**
   * Send a campaign to all pending recipients
   * @param {number} campaignId - Campaign ID
   * @returns {Promise<Object>} Updated campaign
   */
  send: async (campaignId) => {
    const { EmailCampaign, EmailTemplate, EmailCampaignRecipient, EmailLog, Setting } = require('../models');

    const campaign = await EmailCampaign.findByPk(campaignId, {
      include: [
        {
          model: EmailTemplate,
          as: 'template'
        },
        {
          model: EmailCampaignRecipient,
          as: 'recipients',
          where: { status: 'pending' },
          required: false
        }
      ]
    });

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    if (!campaign.template) {
      throw ApiError.badRequest('Campaign does not have an associated email template');
    }

    if (!campaign.recipients || campaign.recipients.length === 0) {
      throw ApiError.badRequest('Campaign has no pending recipients. Build the audience first.');
    }

    // Validate SMTP settings
    const smtpKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'];
    const smtpSettings = await Setting.findAll({
      where: { setting_key: { [Op.in]: smtpKeys } },
      raw: true
    });

    const smtpConfig = {};
    for (const setting of smtpSettings) {
      smtpConfig[setting.setting_key] = setting.setting_value;
    }

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
        pass: smtpConfig.smtp_pass
      }
    });

    // Update campaign status to sending
    await campaign.update({ status: 'sending' });

    let sentCount = campaign.sent_count || 0;
    let failedCount = campaign.failed_count || 0;

    // Send email to each recipient
    for (const recipient of campaign.recipients) {
      try {
        // Merge template variables: replace {{variable}} with entity data
        let mergedBody = campaign.template.body_html;
        const variablePattern = /\{\{(\w+)\}\}/g;
        mergedBody = mergedBody.replace(variablePattern, (match, variable) => {
          if (variable === 'email') return recipient.email;
          return match;
        });

        const mailOptions = {
          from: smtpConfig.smtp_user,
          to: recipient.email,
          subject: campaign.subject,
          html: mergedBody
        };

        await transporter.sendMail(mailOptions);

        // Update recipient status to sent
        await recipient.update({
          status: 'sent',
          sent_at: new Date()
        });

        sentCount++;

        // Create EmailLog entry
        await EmailLog.create({
          template_id: campaign.template_id,
          recipient_email: recipient.email,
          subject: campaign.subject,
          body: mergedBody,
          status: 'sent',
          sent_at: new Date(),
          sent_by: campaign.created_by
        });
      } catch (err) {
        // Update recipient status to failed
        await recipient.update({
          status: 'failed',
          error_message: err.message
        });

        failedCount++;

        // Create EmailLog entry for failed send
        await EmailLog.create({
          template_id: campaign.template_id,
          recipient_email: recipient.email,
          subject: campaign.subject,
          body: campaign.template.body_html,
          status: 'failed',
          error_message: err.message,
          sent_by: campaign.created_by
        });
      }
    }

    // Update campaign with final counts and status
    await campaign.update({
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount
    });

    return campaign;
  },

  /**
   * Schedule a campaign for future sending
   * @param {number} campaignId - Campaign ID
   * @param {string} scheduledAt - ISO date string for when to send
   * @returns {Promise<Object>} Updated campaign
   */
  schedule: async (campaignId, scheduledAt) => {
    const { EmailCampaign } = require('../models');

    const campaign = await EmailCampaign.findByPk(campaignId);

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    if (!scheduledAt) {
      throw ApiError.badRequest('Scheduled date/time is required');
    }

    await campaign.update({
      scheduled_at: scheduledAt,
      status: 'scheduled'
    });

    return campaign;
  },

  /**
   * Get campaign statistics with recipient details
   * @param {number} campaignId - Campaign ID
   * @returns {Promise<Object>} Campaign stats with recipients
   */
  getStats: async (campaignId) => {
    const { EmailCampaign, EmailCampaignRecipient } = require('../models');

    const campaign = await EmailCampaign.findByPk(campaignId, {
      include: [
        {
          model: EmailCampaignRecipient,
          as: 'recipients'
        }
      ]
    });

    if (!campaign) {
      throw ApiError.notFound('Email campaign not found');
    }

    return {
      total_recipients: campaign.total_recipients,
      sent_count: campaign.sent_count,
      failed_count: campaign.failed_count,
      opened_count: campaign.opened_count,
      clicked_count: campaign.clicked_count,
      recipients: campaign.recipients
    };
  }
};

module.exports = emailCampaignService;
