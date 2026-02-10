const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const dealService = {
  /**
   * Get all deals with pagination, search, and filters
   */
  getAll: async (query, userId, userRoles) => {
    const { Deal, User, Contact, Company, PipelineStage, sequelize } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, pipeline_id, stage_id, owner_id, min_value, max_value } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search by title
    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by pipeline
    if (pipeline_id) {
      where.pipeline_id = pipeline_id;
    }

    // Filter by stage
    if (stage_id) {
      where.stage_id = stage_id;
    }

    // Filter by owner
    if (owner_id) {
      where.owner_id = owner_id;
    }

    // Filter by value range
    if (min_value !== undefined || max_value !== undefined) {
      where.value = {};
      if (min_value !== undefined) {
        where.value[Op.gte] = parseFloat(min_value);
      }
      if (max_value !== undefined) {
        where.value[Op.lte] = parseFloat(max_value);
      }
    }

    // Sales Reps see only their own deals
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    if (isSalesRep) {
      where.owner_id = userId;
    }

    const { count, rows } = await Deal.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
        },
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color', 'probability'],
        },
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  },

  /**
   * Get deal by ID with full details
   */
  getById: async (id) => {
    const { Deal, User, Contact, Company, Pipeline, PipelineStage, Activity } = require('../models');

    const deal = await Deal.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone'],
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'website', 'industry'],
        },
        {
          model: Pipeline,
          as: 'pipeline',
          attributes: ['id', 'name'],
          include: [
            {
              model: PipelineStage,
              as: 'stages',
              attributes: ['id', 'name', 'position', 'color', 'probability'],
              order: [['position', 'ASC']],
            },
          ],
        },
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color', 'probability', 'position'],
        },
        {
          model: Activity,
          as: 'activities',
          limit: 10,
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!deal) {
      throw ApiError.notFound('Deal not found');
    }

    return deal;
  },

  /**
   * Create a new deal
   */
  create: async (data, userId) => {
    const { Deal, Pipeline, PipelineStage } = require('../models');

    let pipelineId = data.pipeline_id;
    let stageId = data.stage_id;

    // If no pipeline specified, use default or first pipeline
    if (!pipelineId) {
      let pipeline = await Pipeline.findOne({ where: { is_default: true } });
      if (!pipeline) {
        pipeline = await Pipeline.findOne();
      }
      if (pipeline) {
        pipelineId = pipeline.id;
      }
    }

    // If no stage specified, use first stage of the pipeline
    if (!stageId && pipelineId) {
      const stage = await PipelineStage.findOne({
        where: { pipeline_id: pipelineId },
        order: [['position', 'ASC']],
      });
      if (stage) {
        stageId = stage.id;
      }
    }

    // Get stage probability if stage exists
    let probability = 0;
    if (stageId) {
      const stage = await PipelineStage.findByPk(stageId);
      if (stage) {
        probability = stage.probability;
      }
    }

    const dealData = {
      title: data.title,
      contact_id: data.contact_id || null,
      company_id: data.company_id || null,
      owner_id: data.owner_id || userId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      value: data.value || 0,
      currency: data.currency || 'USD',
      probability: data.probability !== undefined ? data.probability : probability,
      expected_close_date: data.expected_close_date || null,
      status: data.status || 'open',
      notes: data.notes,
      tags: data.tags || [],
      created_by: userId,
    };

    const deal = await Deal.create(dealData);
    return deal;
  },

  /**
   * Update a deal
   */
  update: async (id, data) => {
    const { Deal, User, Contact, Company, PipelineStage } = require('../models');

    const deal = await Deal.findByPk(id);
    if (!deal) {
      throw ApiError.notFound('Deal not found');
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.contact_id !== undefined) updateData.contact_id = data.contact_id;
    if (data.company_id !== undefined) updateData.company_id = data.company_id;
    if (data.owner_id !== undefined) updateData.owner_id = data.owner_id;
    if (data.pipeline_id !== undefined) updateData.pipeline_id = data.pipeline_id;
    if (data.stage_id !== undefined) updateData.stage_id = data.stage_id;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.expected_close_date !== undefined) updateData.expected_close_date = data.expected_close_date;
    if (data.actual_close_date !== undefined) updateData.actual_close_date = data.actual_close_date;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.lost_reason !== undefined) updateData.lost_reason = data.lost_reason;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.tags !== undefined) updateData.tags = data.tags;

    await deal.update(updateData);

    return await Deal.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
        },
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color', 'probability'],
        },
      ],
    });
  },

  /**
   * Update deal stage
   */
  updateStage: async (id, stageId) => {
    const { Deal, PipelineStage } = require('../models');

    const deal = await Deal.findByPk(id);
    if (!deal) {
      throw ApiError.notFound('Deal not found');
    }

    const stage = await PipelineStage.findByPk(stageId);
    if (!stage) {
      throw ApiError.notFound('Stage not found');
    }

    // Update stage and probability from the new stage
    await deal.update({
      stage_id: stageId,
      probability: stage.probability,
    });

    return await Deal.findByPk(id, {
      include: [
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color', 'probability'],
        },
      ],
    });
  },

  /**
   * Soft delete a deal
   */
  delete: async (id) => {
    const { Deal } = require('../models');

    const deal = await Deal.findByPk(id);
    if (!deal) {
      throw ApiError.notFound('Deal not found');
    }

    await deal.destroy();
    return deal;
  },

  /**
   * Get deals by pipeline (for kanban view)
   */
  getByPipeline: async (pipelineId, userId, userRoles) => {
    const { Deal, Pipeline, PipelineStage, User, Contact, Company } = require('../models');

    // If no pipeline ID provided, use default or first pipeline
    let targetPipelineId = pipelineId;
    if (!targetPipelineId) {
      let pipeline = await Pipeline.findOne({ where: { is_default: true } });
      if (!pipeline) {
        pipeline = await Pipeline.findOne();
      }
      if (pipeline) {
        targetPipelineId = pipeline.id;
      } else {
        throw ApiError.notFound('No pipeline found');
      }
    }

    // Get pipeline with stages
    const pipeline = await Pipeline.findByPk(targetPipelineId, {
      include: [
        {
          model: PipelineStage,
          as: 'stages',
          attributes: ['id', 'name', 'position', 'color', 'probability'],
          order: [['position', 'ASC']],
        },
      ],
    });

    if (!pipeline) {
      throw ApiError.notFound('Pipeline not found');
    }

    // Build where clause for deals
    const dealWhere = {
      pipeline_id: targetPipelineId,
      status: 'open', // Only show open deals in kanban view
    };

    // Sales Reps see only their own deals
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    if (isSalesRep) {
      dealWhere.owner_id = userId;
    }

    // Get all deals for this pipeline
    const deals = await Deal.findAll({
      where: dealWhere,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
        },
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color', 'probability'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Group deals by stage
    const stages = pipeline.stages.map(stage => {
      const stageDeals = deals.filter(deal => deal.stage_id === stage.id);
      return {
        ...stage.toJSON(),
        deals: stageDeals,
        totalValue: stageDeals.reduce((sum, deal) => sum + parseFloat(deal.value || 0), 0),
        count: stageDeals.length,
      };
    });

    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        is_default: pipeline.is_default,
      },
      stages,
    };
  },

  /**
   * Get deal statistics
   */
  getStats: async () => {
    const { Deal, PipelineStage, sequelize } = require('../models');

    // Total open deals count
    const openDealsCount = await Deal.count({
      where: { status: 'open' },
    });

    // Total value of open deals
    const openDealsValue = await Deal.sum('value', {
      where: { status: 'open' },
    });

    // Won deals count
    const wonDealsCount = await Deal.count({
      where: { status: 'won' },
    });

    // Won deals value
    const wonDealsValue = await Deal.sum('value', {
      where: { status: 'won' },
    });

    // Lost deals count
    const lostDealsCount = await Deal.count({
      where: { status: 'lost' },
    });

    // Average deal value
    const avgDealValue = await Deal.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('value')), 'avgValue']],
      where: { status: 'open' },
      raw: true,
    });

    // Deals by stage count
    const stageStats = await Deal.findAll({
      attributes: [
        'stage_id',
        [sequelize.fn('COUNT', sequelize.col('Deal.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('value')), 'totalValue'],
      ],
      where: { status: 'open' },
      include: [
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color'],
        },
      ],
      group: ['stage_id', 'stage.id'],
      raw: true,
      nest: true,
    });

    return {
      openDeals: {
        count: openDealsCount || 0,
        totalValue: openDealsValue || 0,
      },
      wonDeals: {
        count: wonDealsCount || 0,
        totalValue: wonDealsValue || 0,
      },
      lostDeals: {
        count: lostDealsCount || 0,
      },
      avgDealValue: avgDealValue?.avgValue ? parseFloat(avgDealValue.avgValue).toFixed(2) : 0,
      dealsByStage: stageStats.map(stat => ({
        stage: stat.stage,
        count: parseInt(stat.count),
        totalValue: parseFloat(stat.totalValue || 0).toFixed(2),
      })),
    };
  },
};

module.exports = dealService;
