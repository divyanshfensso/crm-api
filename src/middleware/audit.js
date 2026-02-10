/**
 * Create an audit log entry
 */
const createAuditLog = async (userId, action, module, recordId = null, oldValues = null, newValues = null, req = null) => {
  try {
    const { AuditLog } = require('../models');

    const ipAddress = req
      ? req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection?.remoteAddress || 'unknown'
      : null;
    const userAgent = req ? req.get('user-agent') || null : null;

    await AuditLog.create({
      user_id: userId,
      action: action.toUpperCase(),
      module: module.toUpperCase(),
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Audit log error:', error.message);
  }
};

module.exports = { createAuditLog };
