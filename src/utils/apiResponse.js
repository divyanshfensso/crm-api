class ApiResponse {
  /**
   * Success response
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} meta - Additional metadata
   * @returns {Object} Standardized success response
   */
  static success(message = 'Success', data = null, meta = null) {
    const response = {
      success: true,
      message
    };

    if (data !== null) {
      response.data = data;
    }

    if (meta !== null) {
      response.meta = meta;
    }

    return response;
  }

  /**
   * Error response
   * @param {string} message - Error message
   * @param {Array|Object} errors - Error details
   * @returns {Object} Standardized error response
   */
  static error(message = 'An error occurred', errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors !== null) {
      response.errors = errors;
    }

    return response;
  }

  /**
   * Paginated response
   * @param {string} message - Success message
   * @param {*} data - Response data (array of items)
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} total - Total number of items
   * @returns {Object} Standardized paginated response
   */
  static paginated(message = 'Success', data = [], page = 1, limit = 20, total = 0) {
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message,
      data,
      meta: {
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total),
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    };
  }

  /**
   * Created response (201)
   * @param {string} message - Success message
   * @param {*} data - Created resource data
   * @returns {Object} Standardized created response
   */
  static created(message = 'Resource created successfully', data = null) {
    return this.success(message, data);
  }

  /**
   * No content response (204)
   * @param {string} message - Success message
   * @returns {Object} Standardized no content response
   */
  static noContent(message = 'Operation successful') {
    return {
      success: true,
      message
    };
  }
}

module.exports = ApiResponse;
