const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

/**
 * Map entity_type to its corresponding model name
 */
const entityModelMap = {
  contact: 'Contact',
  lead: 'Lead',
  deal: 'Deal',
  company: 'Company',
  task: 'Task',
};

/**
 * Evaluate a condition step against the context entity
 * @param {Object} config - Condition config { field, operator, value }
 * @param {Object} entity - The entity to check against
 * @returns {boolean} Whether the condition passes
 */
const evaluateCondition = (config, entity) => {
  if (!config || !config.field || !config.operator) return false;

  const fieldValue = entity[config.field];
  const targetValue = config.value;

  switch (config.operator) {
    case 'equals':
      return fieldValue == targetValue;
    case 'not_equals':
      return fieldValue != targetValue;
    case 'contains':
      return String(fieldValue || '').includes(String(targetValue || ''));
    case 'greater_than':
      return Number(fieldValue) > Number(targetValue);
    case 'less_than':
      return Number(fieldValue) < Number(targetValue);
    default:
      return false;
  }
};

const workflowService = {
  /**
   * Get all workflows with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated workflows list
   */
  getAll: async (query) => {
    const { Workflow, User, WorkflowStep, WorkflowLog, sequelize } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, entity_type, trigger_type, is_active } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search on name
    if (search) {
      const searchCondition = buildSearchCondition(search, ['name']);
      Object.assign(where, searchCondition);
    }

    // Filter by entity_type
    if (entity_type) {
      where.entity_type = entity_type;
    }

    // Filter by trigger_type
    if (trigger_type) {
      where.trigger_type = trigger_type;
    }

    // Filter by is_active
    if (is_active !== undefined) {
      where.is_active = is_active === 'true' || is_active === true;
    }

    const { count, rows } = await Workflow.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      attributes: {
        include: [
          [
            sequelize.literal(
              '(SELECT COUNT(*) FROM workflow_steps WHERE workflow_steps.workflow_id = Workflow.id)'
            ),
            'steps_count',
          ],
          [
            sequelize.literal(
              '(SELECT COUNT(*) FROM workflow_logs WHERE workflow_logs.workflow_id = Workflow.id)'
            ),
            'logs_count',
          ],
        ],
      },
      order,
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  },

  /**
   * Get workflow by ID with creator, steps, and last 10 logs
   * @param {number} id - Workflow ID
   * @returns {Promise<Object>} Workflow with relations
   */
  getById: async (id) => {
    const { Workflow, User, WorkflowStep, WorkflowLog } = require('../models');

    const workflow = await Workflow.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: WorkflowStep,
          as: 'steps',
          order: [['position', 'ASC']],
        },
        {
          model: WorkflowLog,
          as: 'logs',
          limit: 10,
          order: [['created_at', 'DESC']],
        },
      ],
      order: [
        [{ model: WorkflowStep, as: 'steps' }, 'position', 'ASC'],
        [{ model: WorkflowLog, as: 'logs' }, 'created_at', 'DESC'],
      ],
    });

    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    return workflow;
  },

  /**
   * Create a new workflow with optional steps
   * @param {Object} data - Workflow data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created workflow
   */
  create: async (data, userId) => {
    const { Workflow, WorkflowStep, sequelize } = require('../models');

    const result = await sequelize.transaction(async (t) => {
      const workflow = await Workflow.create(
        {
          name: data.name,
          description: data.description || null,
          entity_type: data.entity_type,
          trigger_type: data.trigger_type,
          trigger_config: data.trigger_config || null,
          is_active: data.is_active !== undefined ? data.is_active : true,
          created_by: userId,
        },
        { transaction: t }
      );

      // If steps array provided, bulkCreate WorkflowStep records
      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        const steps = data.steps.map((step, index) => ({
          workflow_id: workflow.id,
          position: step.position !== undefined ? step.position : index,
          step_type: step.step_type,
          config: step.config,
        }));
        await WorkflowStep.bulkCreate(steps, { transaction: t });
      }

      return workflow;
    });

    return await workflowService.getById(result.id);
  },

  /**
   * Update a workflow with optional step replacement
   * @param {number} id - Workflow ID
   * @param {Object} data - Updated workflow data
   * @returns {Promise<Object>} Updated workflow
   */
  update: async (id, data) => {
    const { Workflow, WorkflowStep, sequelize } = require('../models');

    const workflow = await Workflow.findByPk(id);

    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    await sequelize.transaction(async (t) => {
      // Update workflow fields
      await workflow.update(
        {
          name: data.name !== undefined ? data.name : workflow.name,
          description: data.description !== undefined ? data.description : workflow.description,
          entity_type: data.entity_type !== undefined ? data.entity_type : workflow.entity_type,
          trigger_type: data.trigger_type !== undefined ? data.trigger_type : workflow.trigger_type,
          trigger_config: data.trigger_config !== undefined ? data.trigger_config : workflow.trigger_config,
          is_active: data.is_active !== undefined ? data.is_active : workflow.is_active,
        },
        { transaction: t }
      );

      // If steps provided, delete existing and recreate
      if (data.steps && Array.isArray(data.steps)) {
        await WorkflowStep.destroy({
          where: { workflow_id: id },
          transaction: t,
        });

        if (data.steps.length > 0) {
          const steps = data.steps.map((step, index) => ({
            workflow_id: id,
            position: step.position !== undefined ? step.position : index,
            step_type: step.step_type,
            config: step.config,
          }));
          await WorkflowStep.bulkCreate(steps, { transaction: t });
        }
      }
    });

    return await workflowService.getById(id);
  },

  /**
   * Soft delete a workflow and destroy its steps
   * @param {number} id - Workflow ID
   * @returns {Promise<Object>} Deleted workflow info
   */
  delete: async (id) => {
    const { Workflow, WorkflowStep } = require('../models');

    const workflow = await Workflow.findByPk(id);

    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    // Destroy steps
    await WorkflowStep.destroy({ where: { workflow_id: id } });

    // Soft delete workflow
    await workflow.destroy();

    return { id: workflow.id };
  },

  /**
   * Execute a workflow — CORE WORKFLOW ENGINE
   * @param {number} workflowId - Workflow ID
   * @param {Object} context - Execution context { entityId, entity, trigger, ... }
   * @returns {Promise<Object>} Workflow execution log
   */
  execute: async (workflowId, context = {}) => {
    const db = require('../models');
    const { Workflow, WorkflowStep, WorkflowLog, Task, EmailLog } = db;

    const workflow = await Workflow.findByPk(workflowId, {
      include: [
        {
          model: WorkflowStep,
          as: 'steps',
        },
      ],
      order: [
        [{ model: WorkflowStep, as: 'steps' }, 'position', 'ASC'],
      ],
    });

    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    const startTime = Date.now();
    const stepsExecuted = [];
    let status = 'success';
    let errorMessage = null;

    try {
      // Load entity if entityId and entity_type provided
      if (context.entityId && !context.entity) {
        const modelName = entityModelMap[workflow.entity_type];
        if (modelName && db[modelName]) {
          context.entity = await db[modelName].findByPk(context.entityId);
        }
      }

      for (const step of workflow.steps) {
        if (step.step_type === 'condition') {
          // Evaluate condition
          const conditionResult = evaluateCondition(step.config, context.entity || {});
          stepsExecuted.push({
            step_id: step.id,
            step_type: 'condition',
            position: step.position,
            result: conditionResult ? 'passed' : 'failed',
          });

          // If condition fails, stop execution
          if (!conditionResult) {
            status = 'partial';
            break;
          }
        } else if (step.step_type === 'action') {
          const config = step.config || {};
          const params = config.params || {};

          try {
            switch (config.action_type) {
              case 'create_task': {
                await Task.create({
                  title: params.title || 'Workflow Task',
                  description: params.description || null,
                  priority: params.priority || 'medium',
                  assigned_to: params.assigned_to || null,
                  created_by: workflow.created_by,
                });
                stepsExecuted.push({
                  step_id: step.id,
                  step_type: 'action',
                  action_type: 'create_task',
                  position: step.position,
                  result: 'executed',
                });
                break;
              }
              case 'update_field': {
                const modelName = entityModelMap[workflow.entity_type];
                if (modelName && db[modelName] && context.entityId) {
                  await db[modelName].update(
                    { [params.field]: params.value },
                    { where: { id: context.entityId } }
                  );
                }
                stepsExecuted.push({
                  step_id: step.id,
                  step_type: 'action',
                  action_type: 'update_field',
                  position: step.position,
                  result: 'executed',
                });
                break;
              }
              case 'send_email': {
                await EmailLog.create({
                  template_id: params.template_id || null,
                  recipient_email: params.recipient_email || 'pending@workflow.local',
                  recipient_name: params.recipient_name || null,
                  subject: params.subject || 'Workflow Email',
                  body: params.body || '',
                  status: 'queued',
                  sent_by: workflow.created_by,
                });
                stepsExecuted.push({
                  step_id: step.id,
                  step_type: 'action',
                  action_type: 'send_email',
                  position: step.position,
                  result: 'queued',
                });
                break;
              }
              case 'assign_user': {
                const modelName = entityModelMap[workflow.entity_type];
                if (modelName && db[modelName] && context.entityId) {
                  await db[modelName].update(
                    { owner_id: params.user_id },
                    { where: { id: context.entityId } }
                  );
                }
                stepsExecuted.push({
                  step_id: step.id,
                  step_type: 'action',
                  action_type: 'assign_user',
                  position: step.position,
                  result: 'executed',
                });
                break;
              }
              default:
                stepsExecuted.push({
                  step_id: step.id,
                  step_type: 'action',
                  action_type: config.action_type,
                  position: step.position,
                  result: 'unknown_action',
                });
            }
          } catch (actionError) {
            stepsExecuted.push({
              step_id: step.id,
              step_type: 'action',
              action_type: config.action_type,
              position: step.position,
              result: 'failed',
              error: actionError.message,
            });
            status = 'partial';
          }
        } else if (step.step_type === 'delay') {
          // Delays are handled by cron/scheduler, not inline
          stepsExecuted.push({
            step_id: step.id,
            step_type: 'delay',
            position: step.position,
            result: 'skipped',
          });
        }
      }
    } catch (err) {
      status = 'failed';
      errorMessage = err.message;
    }

    const executionTime = Date.now() - startTime;

    // Create WorkflowLog
    const log = await WorkflowLog.create({
      workflow_id: workflowId,
      entity_type: workflow.entity_type,
      entity_id: context.entityId || null,
      status,
      execution_time: executionTime,
      steps_executed: stepsExecuted,
      error_message: errorMessage,
    });

    // Increment execution_count and set last_executed_at
    await workflow.increment('execution_count');
    await workflow.update({ last_executed_at: new Date() });

    return log;
  },

  /**
   * Get paginated logs for a workflow
   * @param {number} workflowId - Workflow ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated logs
   */
  getLogs: async (workflowId, query) => {
    const { Workflow, WorkflowLog } = require('../models');
    const { page, limit, offset } = getPagination(query);

    // Verify workflow exists
    const workflow = await Workflow.findByPk(workflowId);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    const { count, rows } = await WorkflowLog.findAndCountAll({
      where: { workflow_id: workflowId },
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  },

  /**
   * Test (dry run) a workflow — evaluate steps but don't execute actions
   * @param {number} workflowId - Workflow ID
   * @param {Object} context - Test context
   * @returns {Promise<Object>} Dry run results
   */
  test: async (workflowId, context = {}) => {
    const db = require('../models');
    const { Workflow, WorkflowStep } = db;

    const workflow = await Workflow.findByPk(workflowId, {
      include: [
        {
          model: WorkflowStep,
          as: 'steps',
        },
      ],
      order: [
        [{ model: WorkflowStep, as: 'steps' }, 'position', 'ASC'],
      ],
    });

    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    // Load entity if entityId provided
    if (context.entityId && !context.entity) {
      const modelName = entityModelMap[workflow.entity_type];
      if (modelName && db[modelName]) {
        context.entity = await db[modelName].findByPk(context.entityId);
      }
    }

    const stepsResult = [];

    for (const step of workflow.steps) {
      if (step.step_type === 'condition') {
        const conditionResult = evaluateCondition(step.config, context.entity || {});
        stepsResult.push({
          step_id: step.id,
          step_type: 'condition',
          position: step.position,
          config: step.config,
          would_result: conditionResult ? 'passed' : 'failed',
        });

        // If condition fails in dry run, stop
        if (!conditionResult) {
          break;
        }
      } else if (step.step_type === 'action') {
        const config = step.config || {};
        stepsResult.push({
          step_id: step.id,
          step_type: 'action',
          position: step.position,
          action_type: config.action_type,
          params: config.params,
          would_result: 'would_execute',
        });
      } else if (step.step_type === 'delay') {
        stepsResult.push({
          step_id: step.id,
          step_type: 'delay',
          position: step.position,
          config: step.config,
          would_result: 'would_delay',
        });
      }
    }

    return {
      workflow_id: workflowId,
      workflow_name: workflow.name,
      dry_run: true,
      steps: stepsResult,
    };
  },
};

module.exports = workflowService;
