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

module.exports = { sanitizeFKFields };
