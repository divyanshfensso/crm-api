const ApiError = require('../utils/apiError');

function toSnakeCase(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

const VALID_ENTITY_TYPES = ['contacts', 'companies', 'leads', 'deals'];

const customFieldService = {
  /**
   * Get all custom fields for a user + entity type
   */
  getByEntity: async (entityType, userId) => {
    const { CustomField } = require('../models');

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      throw ApiError.badRequest(`Invalid entity type. Valid: ${VALID_ENTITY_TYPES.join(', ')}`);
    }

    const fields = await CustomField.findAll({
      where: { entity_type: entityType, created_by: userId },
      order: [['created_at', 'ASC']]
    });

    return fields;
  },

  /**
   * Get all custom fields for a user (all entity types)
   */
  getAllForUser: async (userId) => {
    const { CustomField } = require('../models');

    const fields = await CustomField.findAll({
      where: { created_by: userId },
      order: [['entity_type', 'ASC'], ['created_at', 'ASC']]
    });

    return fields;
  },

  /**
   * Create a new custom field definition
   */
  create: async (data, userId) => {
    const { CustomField } = require('../models');

    if (!data.field_label || !data.field_label.trim()) {
      throw ApiError.badRequest('Field label is required');
    }

    if (!VALID_ENTITY_TYPES.includes(data.entity_type)) {
      throw ApiError.badRequest(`Invalid entity type. Valid: ${VALID_ENTITY_TYPES.join(', ')}`);
    }

    const field_key = toSnakeCase(data.field_label);
    if (!field_key) {
      throw ApiError.badRequest('Invalid field label — must contain at least one alphanumeric character');
    }

    // Check uniqueness
    const existing = await CustomField.findOne({
      where: { entity_type: data.entity_type, field_key, created_by: userId }
    });
    if (existing) {
      throw ApiError.conflict(`Custom field "${data.field_label}" already exists for this entity type`);
    }

    const field = await CustomField.create({
      entity_type: data.entity_type,
      field_key,
      field_label: data.field_label.trim(),
      field_type: data.field_type || 'text',
      options: data.field_type === 'select' ? (data.options || []) : null,
      created_by: userId
    });

    return field;
  },

  /**
   * Create multiple custom fields at once (for import wizard)
   * Tolerant of duplicates — returns existing field on conflict
   */
  bulkCreate: async (fields, userId) => {
    const { CustomField } = require('../models');
    const created = [];

    for (const f of fields) {
      try {
        const field = await customFieldService.create(f, userId);
        created.push(field);
      } catch (err) {
        if (err.statusCode === 409) {
          // Field already exists — fetch and return it
          const field_key = toSnakeCase(f.field_label);
          const existing = await CustomField.findOne({
            where: {
              entity_type: f.entity_type,
              field_key,
              created_by: userId
            }
          });
          if (existing) created.push(existing);
        } else {
          throw err;
        }
      }
    }

    return created;
  },

  /**
   * Update a custom field definition (label, options only)
   */
  update: async (id, data, userId) => {
    const { CustomField } = require('../models');

    const field = await CustomField.findOne({ where: { id, created_by: userId } });
    if (!field) {
      throw ApiError.notFound('Custom field not found');
    }

    const updates = {};
    if (data.field_label) updates.field_label = data.field_label.trim();
    if (data.options !== undefined) updates.options = data.options;

    await field.update(updates);
    return field;
  },

  /**
   * Delete a custom field definition
   */
  delete: async (id, userId) => {
    const { CustomField } = require('../models');

    const field = await CustomField.findOne({ where: { id, created_by: userId } });
    if (!field) {
      throw ApiError.notFound('Custom field not found');
    }

    await field.destroy();
    return true;
  }
};

module.exports = customFieldService;
