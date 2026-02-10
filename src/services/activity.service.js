const { Activity, Contact, Company, Deal, Lead, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const ApiError = require('../utils/apiError');
const { sanitizeFKFields } = require('../utils/helpers');

const ACTIVITY_FK_FIELDS = ['contact_id', 'company_id', 'deal_id', 'lead_id'];

class ActivityService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query);
    const order = getSorting(query, 'created_at', 'DESC');
    const { search } = query;

    // Build filter conditions
    const where = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.user_id) {
      where.user_id = query.user_id;
    }

    if (query.contact_id) {
      where.contact_id = query.contact_id;
    }

    if (query.company_id) {
      where.company_id = query.company_id;
    }

    if (query.deal_id) {
      where.deal_id = query.deal_id;
    }

    if (query.lead_id) {
      where.lead_id = query.lead_id;
    }

    if (query.completed !== undefined) {
      where.completed = query.completed === 'true' || query.completed === true;
    }

    // Search in subject and description
    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Activity.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'website']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title', 'value', 'status']
        },
        {
          model: Lead,
          as: 'lead',
          attributes: ['id', 'first_name', 'last_name', 'email', 'status']
        }
      ]
    });

    return {
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
    };
  }

  async getById(id) {
    const activity = await Activity.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'website', 'industry']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title', 'value', 'status', 'stage_id']
        },
        {
          model: Lead,
          as: 'lead',
          attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'lead_source']
        }
      ]
    });

    if (!activity) {
      throw ApiError.notFound('Activity not found');
    }

    return activity;
  }

  async create(data, userId) {
    const cleanData = sanitizeFKFields(data, ACTIVITY_FK_FIELDS);
    const activityData = {
      ...cleanData,
      user_id: userId
    };

    const activity = await Activity.create(activityData);

    return this.getById(activity.id);
  }

  async update(id, data) {
    const activity = await Activity.findByPk(id);

    if (!activity) {
      throw ApiError.notFound('Activity not found');
    }

    const cleanData = sanitizeFKFields(data, ACTIVITY_FK_FIELDS);

    // If marking as completed and it wasn't completed before
    if (cleanData.completed === true && !activity.completed) {
      cleanData.completed_at = new Date();
    }

    // If marking as not completed, clear completed_at
    if (cleanData.completed === false) {
      cleanData.completed_at = null;
    }

    await activity.update(cleanData);

    return this.getById(activity.id);
  }

  async delete(id) {
    const activity = await Activity.findByPk(id);

    if (!activity) {
      throw ApiError.notFound('Activity not found');
    }

    await activity.destroy();

    return activity;
  }

  async getRecent(limit = 10) {
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
}

module.exports = new ActivityService();
