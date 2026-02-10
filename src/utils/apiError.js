class ApiError extends Error {
  /**
   * Custom API Error class
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Array|Object} errors - Detailed error information
   */
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Bad Request (400)
   * @param {string} message - Error message
   * @param {Array|Object} errors - Validation errors
   * @returns {ApiError}
   */
  static badRequest(message = 'Bad Request', errors = []) {
    return new ApiError(message, 400, errors);
  }

  /**
   * Unauthorized (401)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(message, 401);
  }

  /**
   * Forbidden (403)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(message, 403);
  }

  /**
   * Not Found (404)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(message, 404);
  }

  /**
   * Conflict (409)
   * @param {string} message - Error message
   * @param {Array|Object} errors - Conflict details
   * @returns {ApiError}
   */
  static conflict(message = 'Conflict', errors = []) {
    return new ApiError(message, 409, errors);
  }

  /**
   * Unprocessable Entity (422)
   * @param {string} message - Error message
   * @param {Array|Object} errors - Validation errors
   * @returns {ApiError}
   */
  static unprocessableEntity(message = 'Unprocessable Entity', errors = []) {
    return new ApiError(message, 422, errors);
  }

  /**
   * Too Many Requests (429)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(message, 429);
  }

  /**
   * Internal Server Error (500)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static internal(message = 'Internal Server Error') {
    return new ApiError(message, 500);
  }

  /**
   * Service Unavailable (503)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static serviceUnavailable(message = 'Service Unavailable') {
    return new ApiError(message, 503);
  }
}

module.exports = ApiError;
