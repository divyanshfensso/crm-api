/**
 * Centralized ENUM values matching database model definitions.
 * Used for import normalization and validation.
 */

const ENUMS = {
  contacts: {
    status: ['active', 'inactive', 'prospect', 'customer', 'churned'],
  },
  leads: {
    status: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'],
  },
  deals: {
    status: ['open', 'won', 'lost'],
    currency: ['USD', 'EUR', 'GBP', 'INR'],
  },
  companies: {},
  tasks: {
    status: ['pending', 'in_progress', 'completed', 'cancelled'],
    priority: ['low', 'medium', 'high', 'urgent'],
  },
  invoices: {
    status: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'],
  },
  quotes: {
    status: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
  },
  payments: {
    payment_method: ['cash', 'bank_transfer', 'credit_card', 'check', 'other'],
  },
};

/**
 * Normalize an ENUM value by case-insensitive matching against valid values.
 * Handles: trimming, lowercasing, and replacing spaces with underscores.
 * Returns the matched valid value (preserving its original case) or the raw input.
 * @param {string} value - The raw input value
 * @param {string[]} validValues - Array of valid ENUM values
 * @returns {string} Normalized value
 */
function normalizeEnumValue(value, validValues) {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, '_');
  // Case-insensitive match — returns the valid value in its original case
  return validValues.find(v => v.toLowerCase() === trimmed) || value;
}

/**
 * Normalize all ENUM fields in a data row for a given entity type.
 * @param {string} entityType - e.g., 'contacts', 'deals'
 * @param {Object} row - The data row to normalize
 * @returns {Object} Row with normalized ENUM values
 */
function normalizeEnumFields(entityType, row) {
  const entityEnums = ENUMS[entityType];
  if (!entityEnums) return row;

  for (const [field, validValues] of Object.entries(entityEnums)) {
    if (row[field] && typeof row[field] === 'string') {
      row[field] = normalizeEnumValue(row[field], validValues);
    }
  }
  return row;
}

module.exports = { ENUMS, normalizeEnumValue, normalizeEnumFields };
