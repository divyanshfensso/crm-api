const ApiError = require('../utils/apiError');

/**
 * Validation middleware factory
 * Creates a middleware function that validates request data against a Joi schema
 *
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Source of data to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    // Validate source parameter
    const validSources = ['body', 'query', 'params'];
    if (!validSources.includes(source)) {
      return next(ApiError.internal(`Invalid validation source: ${source}`));
    }

    // Get data from specified source
    const dataToValidate = req[source];

    // Validation options
    const options = {
      abortEarly: false, // Include all errors, not just the first one
      allowUnknown: true, // Allow unknown keys that will be ignored
      stripUnknown: false, // Don't remove unknown keys
      errors: {
        wrap: {
          label: '' // Don't wrap field names in quotes
        }
      }
    };

    // Validate data against schema
    const { error, value } = schema.validate(dataToValidate, options);

    // If validation fails, return error
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      return next(ApiError.badRequest('Validation failed', errors));
    }

    // Replace request data with validated and sanitized data
    req[source] = value;

    // Store original data if needed for audit
    if (!req.validatedData) {
      req.validatedData = {};
    }
    req.validatedData[source] = value;

    next();
  };
};

/**
 * Validate multiple sources at once
 *
 * @param {Object} schemas - Object with schemas for different sources
 * @example
 * validateMultiple({
 *   body: createUserSchema,
 *   query: paginationSchema,
 *   params: idParamSchema
 * })
 */
const validateMultiple = (schemas) => {
  return async (req, res, next) => {
    const errors = [];

    // Validate each source
    for (const [source, schema] of Object.entries(schemas)) {
      const validSources = ['body', 'query', 'params'];
      if (!validSources.includes(source)) {
        return next(ApiError.internal(`Invalid validation source: ${source}`));
      }

      const dataToValidate = req[source];

      const options = {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: false,
        errors: {
          wrap: {
            label: ''
          }
        }
      };

      const { error, value } = schema.validate(dataToValidate, options);

      if (error) {
        const sourceErrors = error.details.map(detail => ({
          source,
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }));
        errors.push(...sourceErrors);
      } else {
        // Replace with validated data
        req[source] = value;
      }
    }

    // If any validation failed, return all errors
    if (errors.length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }

    next();
  };
};

/**
 * Sanitize request data by removing specified fields
 * Useful for removing sensitive fields before processing
 *
 * @param {Array} fields - Array of field names to remove
 * @param {string} source - Source to sanitize ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const sanitize = (fields = [], source = 'body') => {
  return (req, res, next) => {
    if (req[source]) {
      fields.forEach(field => {
        delete req[source][field];
      });
    }
    next();
  };
};

module.exports = {
  validate,
  validateMultiple,
  sanitize
};
