const { Activity, Contact, Company, Deal, Lead, User, Pipeline, PipelineStage, sequelize } = require('../models');
const { Op } = require('sequelize');

class DashboardService {
  async getStats() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Contacts stats
    const totalContacts = await Contact.count();
    const activeContacts = await Contact.count({
      where: { status: 'active' }
    });
    const newContactsThisMonth = await Contact.count({
      where: {
        created_at: {
          [Op.gte]: currentMonthStart
        }
      }
    });

    // Companies stats
    const totalCompanies = await Company.count();

    // Leads stats
    const totalLeads = await Lead.count();
    const newLeads = await Lead.count({
      where: { status: 'new' }
    });
    const qualifiedLeads = await Lead.count({
      where: { status: 'qualified' }
    });
    const convertedLeads = await Lead.count({
      where: { status: 'converted' }
    });
    const conversionRate = totalLeads > 0
      ? ((convertedLeads / totalLeads) * 100).toFixed(2)
      : 0;

    // Deals stats
    const totalOpenDeals = await Deal.count({
      where: { status: 'open' }
    });

    const openDealsValue = await Deal.sum('value', {
      where: { status: 'open' }
    }) || 0;

    const wonDealsCount = await Deal.count({
      where: { status: 'won' }
    });

    const wonDealsValue = await Deal.sum('value', {
      where: { status: 'won' }
    }) || 0;

    const lostDealsCount = await Deal.count({
      where: { status: 'lost' }
    });

    const totalDealsWithValue = await Deal.count({
      where: {
        value: {
          [Op.gt]: 0
        }
      }
    });

    const avgDealSize = totalDealsWithValue > 0
      ? ((await Deal.sum('value') || 0) / totalDealsWithValue).toFixed(2)
      : 0;

    // Activities stats
    const activitiesThisMonth = await Activity.count({
      where: {
        created_at: {
          [Op.gte]: currentMonthStart
        }
      }
    });

    const overdueActivities = await Activity.count({
      where: {
        due_date: {
          [Op.lt]: now
        },
        completed: false
      }
    });

    return {
      contacts: {
        total: totalContacts,
        active: activeContacts,
        new_this_month: newContactsThisMonth
      },
      companies: {
        total: totalCompanies
      },
      leads: {
        total: totalLeads,
        new_count: newLeads,
        qualified: qualifiedLeads,
        converted: convertedLeads,
        conversion_rate: parseFloat(conversionRate)
      },
      deals: {
        total_open: totalOpenDeals,
        total_value: parseFloat(openDealsValue),
        won_count: wonDealsCount,
        won_value: parseFloat(wonDealsValue),
        lost_count: lostDealsCount,
        avg_deal_size: parseFloat(avgDealSize)
      },
      activities: {
        total_this_month: activitiesThisMonth,
        overdue: overdueActivities
      }
    };
  }

  async getPipelineData(pipelineId = null) {
    let pipeline;

    if (pipelineId) {
      pipeline = await Pipeline.findByPk(pipelineId, {
        include: [
          {
            model: PipelineStage,
            as: 'stages',
            order: [['position', 'ASC']]
          }
        ]
      });
    } else {
      pipeline = await Pipeline.findOne({
        where: { is_default: true },
        include: [
          {
            model: PipelineStage,
            as: 'stages',
            order: [['position', 'ASC']]
          }
        ]
      });
    }

    if (!pipeline) {
      return {
        pipeline: null,
        stages: []
      };
    }

    // Get deal counts and values for each stage
    const stagesWithData = await Promise.all(
      pipeline.stages.map(async (stage) => {
        const dealCount = await Deal.count({
          where: { stage_id: stage.id }
        });

        const totalValue = await Deal.sum('value', {
          where: { stage_id: stage.id }
        }) || 0;

        return {
          id: stage.id,
          name: stage.name,
          position: stage.position,
          color: stage.color || '#0072BC',
          count: dealCount,
          totalValue: parseFloat(totalValue)
        };
      })
    );

    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        is_default: pipeline.is_default
      },
      stages: stagesWithData
    };
  }

  async getRevenueData(period = 'monthly') {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const wonDeals = await Deal.findAll({
      where: {
        status: 'won',
        actual_close_date: {
          [Op.gte]: twelveMonthsAgo
        }
      },
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('actual_close_date'), '%Y-%m'), 'month'],
        [sequelize.fn('SUM', sequelize.col('value')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'deal_count']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('actual_close_date'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('actual_close_date'), '%Y-%m'), 'ASC']],
      raw: true
    });

    // Fill in missing months with zero revenue
    const revenueByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const existingData = wonDeals.find(d => d.month === monthKey);

      revenueByMonth.push({
        month: monthKey,
        revenue: existingData ? parseFloat(existingData.revenue) : 0,
        deal_count: existingData ? parseInt(existingData.deal_count) : 0
      });
    }

    return revenueByMonth;
  }

  async getRecentActivities(limit = 10) {
    const activities = await Activity.findAll({
      limit: parseInt(limit),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title', 'value']
        },
        {
          model: Lead,
          as: 'lead',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    return activities;
  }

  async getLeadSourceData() {
    const leadsBySource = await Lead.findAll({
      attributes: [
        'lead_source',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['lead_source'],
      raw: true
    });

    return leadsBySource.map(item => ({
      source: item.lead_source || 'Unknown',
      count: parseInt(item.count)
    }));
  }
}

module.exports = new DashboardService();
