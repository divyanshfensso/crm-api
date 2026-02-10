const { createAuditLog } = require('../middleware/audit');
const auditService = require('../services/audit.service');
const ApiResponse = require('../utils/apiResponse');

const settingsController = {
  getSettings: async (req, res, next) => {
    try {
      const { Setting } = require('../models');
      const settings = await Setting.findAll();

      const settingsMap = {};
      settings.forEach(s => {
        settingsMap[s.setting_key] = {
          value: s.setting_value,
          type: s.setting_type,
        };
      });

      res.json(ApiResponse.success('Settings retrieved', { settings: settingsMap }));
    } catch (error) {
      next(error);
    }
  },

  updateSettings: async (req, res, next) => {
    try {
      const { Setting } = require('../models');
      const updates = req.body.settings;

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json(ApiResponse.error('Settings object required'));
      }

      for (const [key, value] of Object.entries(updates)) {
        await Setting.upsert({
          setting_key: key,
          setting_value: String(value),
          setting_type: typeof value,
        });
      }

      await createAuditLog(req.user.id, 'update', 'settings', null, null, updates, req);

      res.json(ApiResponse.success('Settings updated'));
    } catch (error) {
      next(error);
    }
  },

  getAuditLogs: async (req, res, next) => {
    try {
      const result = await auditService.getAll(req.query);
      res.json(ApiResponse.success('Audit logs retrieved', result.data, result.meta));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = settingsController;
