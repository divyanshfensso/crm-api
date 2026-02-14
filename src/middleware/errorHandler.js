const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Global error handling middleware
 * Catches all errors and returns standardized error responses
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode
    });
  }

  // Handle Sequelize Validation Errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
    error = ApiError.badRequest('Validation error', errors);
  }

  // Handle Sequelize Unique Constraint Errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const fieldLabels = {
      email: 'Email', name: 'Name', phone: 'Phone', username: 'Username',
      gstin: 'GSTIN', pan_number: 'PAN number', title: 'Title',
    };
    const errors = err.errors.map(e => ({
      field: e.path,
      message: `${fieldLabels[e.path] || e.path} already exists. Please use a different value.`,
      value: e.value
    }));
    const firstLabel = err.errors[0] ? (fieldLabels[err.errors[0].path] || err.errors[0].path) : 'Value';
    error = ApiError.conflict(`${firstLabel} already exists. Please use a different value.`, errors);
  }

  // Handle Sequelize Foreign Key Constraint Errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const fieldLabels = {
      company_id: 'company', contact_id: 'contact', deal_id: 'deal',
      quote_id: 'quote', pipeline_id: 'pipeline', stage_id: 'pipeline stage',
      owner_id: 'user', assigned_to: 'user', created_by: 'user',
      parent_company_id: 'parent company', lead_id: 'lead',
    };
    const fkField = err.fields ? err.fields[0] : null;
    const label = (fkField && fieldLabels[fkField]) || 'referenced record';

    console.error('FK Constraint Error Details:', {
      fields: err.fields,
      table: err.table,
      index: err.index,
      value: err.value,
      parent: err.parent ? err.parent.message : 'N/A'
    });
    error = ApiError.badRequest(
      `Please select a valid ${label}. The selected ${label} does not exist.`
    );
  }

  // Handle Sequelize Database Errors
  if (err.name === 'SequelizeDatabaseError') {
    const dbMsg = process.env.NODE_ENV === 'development'
      ? `Database error: ${err.message}`
      : 'Database error occurred';
    error = ApiError.internal(dbMsg);
  }

  // Handle Sequelize Connection Errors
  if (err.name === 'SequelizeConnectionError') {
    error = ApiError.serviceUnavailable('Database connection error');
  }

  // Handle Sequelize Timeout Errors
  if (err.name === 'SequelizeTimeoutError') {
    error = ApiError.serviceUnavailable('Database operation timeout');
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token has expired');
  }

  // Handle Multer Errors (File Upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = ApiError.badRequest('File size exceeds limit');
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      error = ApiError.badRequest('Too many files uploaded');
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      error = ApiError.badRequest('Unexpected file field');
    } else {
      error = ApiError.badRequest('File upload error');
    }
  }

  // Handle Syntax Errors (Invalid JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = ApiError.badRequest('Invalid JSON format');
  }

  // If error is not an ApiError instance, convert it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(message, statusCode);
  }

  // Prepare error response
  const response = ApiResponse.error(error.message, error.errors);

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  // Send error response
  res.status(error.statusCode).json(response);
};

/**
 * Handle 404 - Route not found
 */
const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
const unhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to log this to an error tracking service
    // and potentially restart the server
  });
};

/**
 * Handle uncaught exceptions
 */
const uncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log to error tracking service
    // Gracefully shutdown the server
    process.exit(1);
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  unhandledRejectionHandler,
  uncaughtExceptionHandler
};
