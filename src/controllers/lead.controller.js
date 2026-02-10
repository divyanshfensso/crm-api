const leadService = require('../services/lead.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const leadController = {
  /**
   * Get all leads with pagination, search, and filters
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await leadService.getAll(req.query, req.user.id, req.userRoles);
    res.json(
      ApiResponse.paginated(
        'Leads retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      )
    );
  }),

  /**
   * Get lead by ID
   */
  getById: asyncHandler(async (req, res) => {
    const lead = await leadService.getById(req.params.id);
    res.json(ApiResponse.success('Lead retrieved successfully', { lead }));
  }),

  /**
   * Create a new lead
   */
  create: asyncHandler(async (req, res) => {
    const lead = await leadService.create(req.body, req.user.id);
    await createAuditLog(
      req.user.id,
      'CREATE',
      'LEAD',
      lead.id,
      null,
      req.body,
      req
    );
    res.status(201).json(ApiResponse.created('Lead created successfully', { lead }));
  }),

  /**
   * Update a lead
   */
  update: asyncHandler(async (req, res) => {
    const lead = await leadService.update(req.params.id, req.body);
    await createAuditLog(
      req.user.id,
      'UPDATE',
      'LEAD',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );
    res.json(ApiResponse.success('Lead updated successfully', { lead }));
  }),

  /**
   * Delete a lead
   */
  delete: asyncHandler(async (req, res) => {
    const lead = await leadService.delete(req.params.id);
    await createAuditLog(
      req.user.id,
      'DELETE',
      'LEAD',
      parseInt(req.params.id),
      null,
      null,
      req
    );
    res.json(ApiResponse.success('Lead deleted successfully', { lead }));
  }),

  /**
   * Convert lead to contact and optionally create a deal
   */
  convert: asyncHandler(async (req, res) => {
    const { dealTitle, dealValue, companyId } = req.body;
    const result = await leadService.convert(
      req.params.id,
      { dealTitle, dealValue, companyId },
      req.user.id
    );
    await createAuditLog(
      req.user.id,
      'CONVERT',
      'LEAD',
      parseInt(req.params.id),
      null,
      { converted: true, dealTitle, dealValue },
      req
    );
    res.json(
      ApiResponse.success('Lead converted successfully', {
        contact: result.contact,
        deal: result.deal,
        lead: result.lead,
      })
    );
  }),

  /**
   * Get lead statistics
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await leadService.getStats();
    res.json(ApiResponse.success('Lead statistics retrieved successfully', stats));
  }),
};

module.exports = leadController;
