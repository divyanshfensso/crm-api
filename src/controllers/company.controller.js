const companyService = require('../services/company.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const companyController = {
  /**
   * Get all companies with pagination, search, and filters
   * GET /api/companies
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await companyService.getAll(req.query, req.user.id, req.userRoles);
    res.json(ApiResponse.paginated(
      'Companies retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get company by ID
   * GET /api/companies/:id
   */
  getById: asyncHandler(async (req, res) => {
    const company = await companyService.getById(req.params.id);
    res.json(ApiResponse.success('Company retrieved successfully', { company }));
  }),

  /**
   * Create a new company
   * POST /api/companies
   */
  create: asyncHandler(async (req, res) => {
    const company = await companyService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'COMPANY',
      company.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Company created successfully', { company }));
  }),

  /**
   * Update an existing company
   * PUT /api/companies/:id
   */
  update: asyncHandler(async (req, res) => {
    const company = await companyService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'COMPANY',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Company updated successfully', { company }));
  }),

  /**
   * Delete a company (soft delete)
   * DELETE /api/companies/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await companyService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'COMPANY',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Company deleted successfully', result));
  }),

  /**
   * Get company statistics
   * GET /api/companies/stats
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await companyService.getStats();
    res.json(ApiResponse.success('Company statistics retrieved successfully', { stats }));
  })
};

module.exports = companyController;
