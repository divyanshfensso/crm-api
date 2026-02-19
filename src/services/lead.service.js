const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields, parseJsonFields, parseJsonFieldsArray } = require('../utils/helpers');

const leadService = {
  /**
   * Get all leads with pagination, search, and filters
   */
  getAll: async (query, userId, userRoles) => {
    const { Lead, User, sequelize } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, lead_source, min_score, max_score } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search across multiple fields
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company_name: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by lead source
    if (lead_source) {
      where.lead_source = lead_source;
    }

    // Filter by score range
    if (min_score !== undefined || max_score !== undefined) {
      where.score = {};
      if (min_score !== undefined) {
        where.score[Op.gte] = parseInt(min_score);
      }
      if (max_score !== undefined) {
        where.score[Op.lte] = parseInt(max_score);
      }
    }

    // Sales Reps see only their own leads
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    if (isSalesRep) {
      where.owner_id = userId;
    }

    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    return {
      data: parseJsonFieldsArray(rows, ['custom_fields', 'tags'], { custom_fields: {}, tags: [] }),
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  },

  /**
   * Get lead by ID with full details
   */
  getById: async (id) => {
    const { Lead, User, Activity, Contact, Deal } = require('../models');

    const lead = await Lead.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Activity,
          as: 'activities',
          limit: 10,
          order: [['created_at', 'DESC']],
        },
        {
          model: Contact,
          as: 'convertedContact',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Deal,
          as: 'convertedDeal',
          attributes: ['id', 'title', 'value', 'status'],
        },
      ],
    });

    if (!lead) {
      throw ApiError.notFound('Lead not found');
    }

    return parseJsonFields(lead, ['custom_fields', 'tags'], { custom_fields: {}, tags: [] });
  },

  /**
   * Create a new lead
   */
  create: async (data, userId) => {
    const { Lead } = require('../models');

    const cleanData = sanitizeFKFields(data, ['owner_id']);
    const leadData = {
      first_name: cleanData.first_name,
      last_name: cleanData.last_name,
      email: cleanData.email,
      phone: cleanData.phone,
      company_name: cleanData.company_name,
      job_title: cleanData.job_title,
      lead_source: cleanData.lead_source,
      status: cleanData.status || 'new',
      score: cleanData.score || 0,
      notes: cleanData.notes,
      tags: cleanData.tags || [],
      owner_id: cleanData.owner_id || userId,
      created_by: userId,
    };

    const lead = await Lead.create(leadData);

    // Emit notification if lead assigned to someone else
    if (leadData.owner_id && leadData.owner_id !== userId) {
      try {
        const { emitNotification } = require('../utils/notificationEmitter');
        await emitNotification('lead_assigned', leadData.owner_id, {
          title: 'New lead assigned to you',
          message: `You have been assigned lead: "${leadData.first_name} ${leadData.last_name}"`,
          sender_id: userId,
          related_module: 'leads',
          related_id: lead.id,
          priority: 'medium'
        });
      } catch (err) {
        console.error('Lead notification error:', err.message);
      }
    }

    return lead;
  },

  /**
   * Update a lead
   */
  update: async (id, data) => {
    const { Lead } = require('../models');

    const lead = await Lead.findByPk(id);
    if (!lead) {
      throw ApiError.notFound('Lead not found');
    }

    const cleanData = sanitizeFKFields(data, ['owner_id']);
    const updateData = {};
    if (cleanData.first_name !== undefined) updateData.first_name = cleanData.first_name;
    if (cleanData.last_name !== undefined) updateData.last_name = cleanData.last_name;
    if (cleanData.email !== undefined) updateData.email = cleanData.email;
    if (cleanData.phone !== undefined) updateData.phone = cleanData.phone;
    if (cleanData.company_name !== undefined) updateData.company_name = cleanData.company_name;
    if (cleanData.job_title !== undefined) updateData.job_title = cleanData.job_title;
    if (cleanData.lead_source !== undefined) updateData.lead_source = cleanData.lead_source;
    if (cleanData.status !== undefined) updateData.status = cleanData.status;
    if (cleanData.score !== undefined) updateData.score = cleanData.score;
    if (cleanData.notes !== undefined) updateData.notes = cleanData.notes;
    if (cleanData.tags !== undefined) updateData.tags = cleanData.tags;
    if (cleanData.owner_id !== undefined) updateData.owner_id = cleanData.owner_id;

    await lead.update(updateData);

    return await Lead.findByPk(id, {
      include: [
        {
          model: require('../models').User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
    });
  },

  /**
   * Soft delete a lead
   */
  delete: async (id) => {
    const { Lead } = require('../models');

    const lead = await Lead.findByPk(id);
    if (!lead) {
      throw ApiError.notFound('Lead not found');
    }

    await lead.destroy();
    return lead;
  },

  /**
   * Convert lead to contact and optionally create a deal
   */
  convert: async (id, data, userId) => {
    const { Lead, Contact, Deal, Pipeline, PipelineStage, sequelize } = require('../models');

    const transaction = await sequelize.transaction();

    try {
      // Find the lead
      const lead = await Lead.findByPk(id, { transaction });
      if (!lead) {
        throw ApiError.notFound('Lead not found');
      }

      // Check if already converted
      if (lead.converted || lead.status === 'converted') {
        throw ApiError.badRequest('Lead has already been converted');
      }

      // Create Contact from lead data
      const contact = await Contact.create(
        {
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          job_title: lead.job_title,
          lead_source: lead.lead_source,
          owner_id: lead.owner_id,
          created_by: userId,
        },
        { transaction }
      );

      // Update lead with converted status
      await lead.update(
        {
          converted: true,
          status: 'converted',
          converted_contact_id: contact.id,
        },
        { transaction }
      );

      let deal = null;

      // Create deal if title and value provided
      if (data.dealTitle && data.dealValue) {
        // Get default pipeline
        let pipeline = await Pipeline.findOne({
          where: { is_default: true },
          transaction,
        });

        // If no default pipeline exists, get the first one
        if (!pipeline) {
          pipeline = await Pipeline.findOne({ transaction });
        }

        let stage = null;
        if (pipeline) {
          // Get first stage of the pipeline
          stage = await PipelineStage.findOne({
            where: { pipeline_id: pipeline.id },
            order: [['position', 'ASC']],
            transaction,
          });
        }

        deal = await Deal.create(
          {
            title: data.dealTitle,
            value: data.dealValue,
            contact_id: contact.id,
            company_id: data.companyId || null,
            owner_id: lead.owner_id,
            pipeline_id: pipeline ? pipeline.id : null,
            stage_id: stage ? stage.id : null,
            probability: stage ? stage.probability : 0,
            status: 'open',
            created_by: userId,
          },
          { transaction }
        );

        // Update lead with converted deal
        await lead.update(
          {
            converted_deal_id: deal.id,
          },
          { transaction }
        );
      }

      await transaction.commit();

      // Return fresh data with associations
      const updatedLead = await Lead.findByPk(id, {
        include: [
          { model: Contact, as: 'convertedContact' },
          { model: Deal, as: 'convertedDeal' },
        ],
      });

      return {
        contact,
        deal,
        lead: updatedLead,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  /**
   * Get lead statistics
   */
  getStats: async () => {
    const { Lead, sequelize } = require('../models');

    // Count by status
    const statusCounts = await Lead.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    // Calculate average score
    const avgScore = await Lead.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('score')), 'avgScore']],
      raw: true,
    });

    // Format status counts
    const statusStats = {};
    statusCounts.forEach(item => {
      statusStats[item.status] = parseInt(item.count);
    });

    return {
      statusCounts: statusStats,
      avgScore: avgScore.avgScore ? parseFloat(avgScore.avgScore).toFixed(2) : 0,
    };
  },
};

module.exports = leadService;
