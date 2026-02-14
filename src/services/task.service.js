const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields } = require('../utils/helpers');

const TASK_FK_FIELDS = ['assigned_to', 'contact_id', 'company_id', 'deal_id'];

const taskService = {
  /**
   * Get all tasks with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @param {number} userId - Current user ID
   * @param {Array} userRoles - Current user roles
   * @returns {Promise<Object>} Paginated tasks list
   */
  getAll: async (query, userId, userRoles) => {
    const { Task, User, Contact, Company, Deal } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, priority, assigned_to } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Role-based filtering: Sales Reps see only their own tasks
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    const isPrivileged = userRoles && (
      userRoles.includes('Admin') ||
      userRoles.includes('Manager') ||
      userRoles.includes('Super Admin')
    );
    if (isSalesRep && !isPrivileged) {
      where.assigned_to = userId;
    }

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['title']);
      Object.assign(where, searchCondition);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
    }

    // Filter by assigned user
    if (assigned_to) {
      where.assigned_to = assigned_to;
    }

    const { count, rows } = await Task.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
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
   * Get task by ID with full details
   * @param {number} id - Task ID
   * @returns {Promise<Object>} Task with relations
   */
  getById: async (id) => {
    const { Task, User, Contact, Company, Deal } = require('../models');

    const task = await Task.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ]
    });

    if (!task) {
      throw ApiError.notFound('Task not found');
    }

    return task;
  },

  /**
   * Create a new task
   * @param {Object} data - Task data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created task
   */
  create: async (data, userId) => {
    const { Task } = require('../models');

    const cleanData = sanitizeFKFields(data, TASK_FK_FIELDS);
    const taskData = {
      ...cleanData,
      created_by: userId
    };

    const task = await Task.create(taskData);

    // Emit notification if task is assigned to someone else
    if (taskData.assigned_to && taskData.assigned_to !== userId) {
      try {
        const { emitNotification } = require('../utils/notificationEmitter');
        await emitNotification('task_assigned', taskData.assigned_to, {
          title: 'New task assigned to you',
          message: `You have been assigned: "${taskData.title}"`,
          sender_id: userId,
          related_module: 'tasks',
          related_id: task.id,
          priority: taskData.priority === 'urgent' ? 'high' : 'medium'
        });
      } catch (err) {
        console.error('Task notification error:', err.message);
      }
    }

    // Fetch the created task with relations
    return await taskService.getById(task.id);
  },

  /**
   * Update an existing task
   * @param {number} id - Task ID
   * @param {Object} data - Updated task data
   * @returns {Promise<Object>} Updated task
   */
  update: async (id, data) => {
    const { Task } = require('../models');

    const task = await Task.findByPk(id);

    if (!task) {
      throw ApiError.notFound('Task not found');
    }

    const cleanData = sanitizeFKFields(data, TASK_FK_FIELDS);

    // If status changed to 'completed', set completed_at
    if (cleanData.status === 'completed' && task.status !== 'completed') {
      cleanData.completed_at = new Date();
    }

    const oldAssignee = task.assigned_to;
    await task.update(cleanData);

    // Emit notification if assignee changed
    if (cleanData.assigned_to && cleanData.assigned_to !== oldAssignee) {
      try {
        const { emitNotification } = require('../utils/notificationEmitter');
        await emitNotification('task_assigned', cleanData.assigned_to, {
          title: 'Task reassigned to you',
          message: `You have been assigned: "${task.title}"`,
          related_module: 'tasks',
          related_id: task.id,
          priority: task.priority === 'urgent' ? 'high' : 'medium'
        });
      } catch (err) {
        console.error('Task notification error:', err.message);
      }
    }

    // Fetch the updated task with relations
    return await taskService.getById(id);
  },

  /**
   * Soft delete a task
   * @param {number} id - Task ID
   * @returns {Promise<Object>} Deleted task info
   */
  delete: async (id) => {
    const { Task } = require('../models');

    const task = await Task.findByPk(id);

    if (!task) {
      throw ApiError.notFound('Task not found');
    }

    await task.destroy();

    return { id: task.id };
  },

  /**
   * Get tasks grouped by status for kanban board
   * @param {number} userId - Current user ID
   * @param {string[]} userRoles - Current user roles
   * @returns {Promise<Object>} Tasks grouped by status
   */
  getByStatus: async (query, userId, userRoles) => {
    const { Task, User, Contact, Company, Deal } = require('../models');

    const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    const priorityOrder = ['urgent', 'high', 'medium', 'low'];
    const { search, priority, assigned_to } = query || {};

    // Role-based filtering: Sales Reps see only their assigned tasks
    const baseWhere = {};
    const isSalesRep = userRoles && userRoles.includes('Sales Rep');
    const isPrivileged = userRoles && (
      userRoles.includes('Super Admin') ||
      userRoles.includes('Admin') ||
      userRoles.includes('Manager')
    );
    if (isSalesRep && !isPrivileged) {
      baseWhere.assigned_to = userId;
    }

    // Apply search filter
    if (search) {
      const searchCondition = buildSearchCondition(search, ['title']);
      Object.assign(baseWhere, searchCondition);
    }

    // Apply priority filter
    if (priority) {
      baseWhere.priority = priority;
    }

    // Apply assigned_to filter (only if not already restricted by role)
    if (assigned_to && !baseWhere.assigned_to) {
      baseWhere.assigned_to = assigned_to;
    }

    const board = {};

    for (const status of statuses) {
      const tasks = await Task.findAll({
        where: { ...baseWhere, status },
        include: [
          {
            model: User,
            as: 'assignee',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'first_name', 'last_name']
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name']
          },
          {
            model: Deal,
            as: 'deal',
            attributes: ['id', 'title']
          }
        ],
        order: [
          [require('sequelize').literal(
            `CASE priority ${priorityOrder.map((p, i) => `WHEN '${p}' THEN ${i}`).join(' ')} ELSE 4 END`
          ), 'ASC'],
          ['due_date', 'ASC']
        ]
      });

      board[status] = tasks;
    }

    return board;
  },

  /**
   * Get task statistics
   * @returns {Promise<Object>} Task stats
   */
  getStats: async () => {
    const { Task, sequelize } = require('../models');

    const total = await Task.count();

    const statusStats = await Task.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const by_status = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0
    };

    statusStats.forEach(stat => {
      by_status[stat.status] = parseInt(stat.count);
    });

    // Overdue: pending or in_progress tasks with due_date in the past
    const overdue = await Task.count({
      where: {
        status: { [Op.in]: ['pending', 'in_progress'] },
        due_date: { [Op.lt]: new Date() }
      }
    });

    return {
      total,
      by_status,
      overdue
    };
  }
};

module.exports = taskService;
