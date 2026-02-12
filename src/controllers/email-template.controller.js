const emailTemplateService = require('../services/email-template.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const emailTemplateController = {
  /**
   * Get all email templates with pagination, search, and filters
   * GET /api/email-templates
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await emailTemplateService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Email templates retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get email template by ID
   * GET /api/email-templates/:id
   */
  getById: asyncHandler(async (req, res) => {
    const template = await emailTemplateService.getById(req.params.id);
    res.json(ApiResponse.success('Email template retrieved successfully', { template }));
  }),

  /**
   * Create a new email template
   * POST /api/email-templates
   */
  create: asyncHandler(async (req, res) => {
    const template = await emailTemplateService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'EMAIL_TEMPLATE',
      template.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Email template created successfully', { template }));
  }),

  /**
   * Update an existing email template
   * PUT /api/email-templates/:id
   */
  update: asyncHandler(async (req, res) => {
    const template = await emailTemplateService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'EMAIL_TEMPLATE',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Email template updated successfully', { template }));
  }),

  /**
   * Delete an email template (soft delete)
   * DELETE /api/email-templates/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await emailTemplateService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'EMAIL_TEMPLATE',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Email template deleted successfully', result));
  }),

  /**
   * Send an email using a template
   * POST /api/email-templates/:id/send
   */
  send: asyncHandler(async (req, res) => {
    const result = await emailTemplateService.sendEmail(
      req.params.id,
      req.body,
      req.user.id
    );

    await createAuditLog(
      req.user.id,
      'SEND',
      'EMAIL_TEMPLATE',
      parseInt(req.params.id),
      null,
      { recipient_email: req.body.recipient_email },
      req
    );

    res.json(ApiResponse.success('Email sent successfully', result));
  })
};

module.exports = emailTemplateController;
