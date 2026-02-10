const contactService = require('../services/contact.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const contactController = {
  /**
   * Get all contacts with pagination, search, and filters
   * GET /api/contacts
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await contactService.getAll(req.query, req.user.id, req.userRoles);
    res.json(ApiResponse.paginated(
      'Contacts retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get contact by ID
   * GET /api/contacts/:id
   */
  getById: asyncHandler(async (req, res) => {
    const contact = await contactService.getById(req.params.id);
    res.json(ApiResponse.success('Contact retrieved successfully', { contact }));
  }),

  /**
   * Create a new contact
   * POST /api/contacts
   */
  create: asyncHandler(async (req, res) => {
    const contact = await contactService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'CONTACT',
      contact.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Contact created successfully', { contact }));
  }),

  /**
   * Update an existing contact
   * PUT /api/contacts/:id
   */
  update: asyncHandler(async (req, res) => {
    const contact = await contactService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'CONTACT',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Contact updated successfully', { contact }));
  }),

  /**
   * Delete a contact (soft delete)
   * DELETE /api/contacts/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await contactService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'CONTACT',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Contact deleted successfully', result));
  }),

  /**
   * Get contact statistics
   * GET /api/contacts/stats
   */
  getStats: asyncHandler(async (req, res) => {
    const stats = await contactService.getStats();
    res.json(ApiResponse.success('Contact statistics retrieved successfully', { stats }));
  })
};

module.exports = contactController;
