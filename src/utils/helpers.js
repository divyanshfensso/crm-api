/**
 * Sanitize foreign key fields — convert empty/invalid values to null
 * Prevents SequelizeForeignKeyConstraintError when forms send "" for optional FK fields
 * Handles: empty string, undefined, 0, "0", whitespace-only strings
 * @param {Object} data - Input data object
 * @param {string[]} fkFields - Array of FK field names to sanitize
 * @returns {Object} Sanitized data copy
 */
const sanitizeFKFields = (data, fkFields) => {
  const sanitized = { ...data };
  for (const field of fkFields) {
    const val = sanitized[field];
    if (
      val === '' ||
      val === undefined ||
      val === null ||
      val === 0 ||
      val === '0' ||
      (typeof val === 'string' && val.trim() === '')
    ) {
      sanitized[field] = null;
    }
  }
  return sanitized;
};

/**
 * Parse JSON string fields on a Sequelize record (or plain object).
 * Handles multiple levels of stringification (MySQL JSON column quirk).
 * @param {Object} record - Sequelize model instance or plain object
 * @param {string[]} fields - JSON field names to parse
 * @param {Object} defaults - Default values per field type: { fieldName: defaultValue }
 * @returns {Object} Plain object with parsed JSON fields
 */
const parseJsonFields = (record, fields = ['custom_fields', 'tags'], defaults = {}) => {
  if (!record) return record;
  const obj = record.toJSON ? record.toJSON() : { ...record };
  for (const field of fields) {
    let val = obj[field];
    if (val === null || val === undefined) {
      obj[field] = defaults[field] !== undefined ? defaults[field] : val;
      continue;
    }
    while (typeof val === 'string') {
      try { val = JSON.parse(val); } catch (e) { break; }
    }
    obj[field] = val;
  }
  return obj;
};

/**
 * Parse JSON fields on an array of Sequelize records.
 * @param {Array} rows - Array of Sequelize model instances
 * @param {string[]} fields - JSON field names to parse
 * @param {Object} defaults - Default values per field type
 * @returns {Array} Array of plain objects with parsed JSON fields
 */
const parseJsonFieldsArray = (rows, fields, defaults) => {
  return rows.map(row => parseJsonFields(row, fields, defaults));
};

module.exports = { sanitizeFKFields, parseJsonFields, parseJsonFieldsArray };
