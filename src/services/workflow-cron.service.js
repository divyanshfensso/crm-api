const cron = require('node-cron');

const setupCronJobs = () => {
  // Check time-based workflows every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const db = require('../models');
      const { Op } = require('sequelize');

      const workflows = await db.Workflow.findAll({
        where: { trigger_type: 'time_based', is_active: true },
        include: [{ model: db.WorkflowStep, as: 'steps', order: [['position', 'ASC']] }],
      });

      const workflowService = require('./workflow.service');

      for (const workflow of workflows) {
        const config = workflow.trigger_config || {};
        if (shouldTrigger(config)) {
          try {
            await workflowService.execute(workflow.id, { trigger: 'cron' });
          } catch (err) {
            console.error(`Workflow ${workflow.id} execution failed:`, err.message);
          }
        }
      }
    } catch (error) {
      console.error('Workflow cron error:', error.message);
    }
  });

  console.log('Workflow cron jobs initialized.');
};

const shouldTrigger = (config) => {
  if (!config || !config.schedule) return false;
  const now = new Date();
  const hour = now.getHours();
  // Simple: trigger at specified hour
  if (config.schedule === 'hourly') return true;
  if (config.schedule === 'daily' && hour === (config.hour || 9)) return true;
  if (config.schedule === 'weekly' && now.getDay() === (config.day || 1) && hour === (config.hour || 9)) return true;
  return false;
};

module.exports = { setupCronJobs };
