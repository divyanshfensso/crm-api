const emailCampaignService = require('../services/email-campaign.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const emailCampaignController = {
  /**
   * Get all email campaigns with pagination, search, and filters
   * GET /api/email-campaigns
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await emailCampaignService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Email campaigns retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get email campaign by ID
   * GET /api/email-campaigns/:id
   */
  getById: asyncHandler(async (req, res) => {
    const campaign = await emailCampaignService.getById(req.params.id);
    res.json(ApiResponse.success('Email campaign retrieved successfully', { campaign }));
  }),

  /**
   * Create a new email campaign
   * POST /api/email-campaigns
   */
  create: asyncHandler(async (req, res) => {
    const campaign = await emailCampaignService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'EMAIL_CAMPAIGN',
      campaign.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Email campaign created successfully', { campaign }));
  }),

  /**
   * Update an existing email campaign
   * PUT /api/email-campaigns/:id
   */
  update: asyncHandler(async (req, res) => {
    const campaign = await emailCampaignService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'EMAIL_CAMPAIGN',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Email campaign updated successfully', { campaign }));
  }),

  /**
   * Delete an email campaign (soft delete)
   * DELETE /api/email-campaigns/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await emailCampaignService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'EMAIL_CAMPAIGN',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Email campaign deleted successfully', result));
  }),

  /**
   * Build audience for a campaign
   * POST /api/email-campaigns/:id/audience
   */
  buildAudience: asyncHandler(async (req, res) => {
    const recipientCount = await emailCampaignService.buildAudience(req.params.id);
    res.json(ApiResponse.success('Audience built successfully', { recipients_count: recipientCount }));
  }),

  /**
   * Send a campaign
   * POST /api/email-campaigns/:id/send
   */
  send: asyncHandler(async (req, res) => {
    const campaign = await emailCampaignService.send(req.params.id);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'EMAIL_CAMPAIGN',
      parseInt(req.params.id),
      null,
      { action: 'send', status: campaign.status, sent_count: campaign.sent_count, failed_count: campaign.failed_count },
      req
    );

    res.json(ApiResponse.success('Campaign sent successfully', { campaign }));
  }),

  /**
   * Schedule a campaign for future sending
   * POST /api/email-campaigns/:id/schedule
   */
  schedule: asyncHandler(async (req, res) => {
    const campaign = await emailCampaignService.schedule(req.params.id, req.body.scheduled_at);
    res.json(ApiResponse.success('Campaign scheduled successfully', { campaign }));
  }),

  /**
   * Get campaign statistics
   * GET /api/email-campaigns/:id/stats or GET /api/email-campaigns/stats
   */
  getStats: asyncHandler(async (req, res) => {
    const campaignId = req.params.id;

    if (!campaignId) {
      // Global stats route: /api/email-campaigns/stats
      const { EmailCampaign, sequelize } = require('../models');

      const stats = await EmailCampaign.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('total_recipients')), 'total_recipients'],
          [sequelize.fn('SUM', sequelize.col('sent_count')), 'sent_count'],
          [sequelize.fn('SUM', sequelize.col('failed_count')), 'failed_count'],
          [sequelize.fn('SUM', sequelize.col('opened_count')), 'opened_count'],
          [sequelize.fn('SUM', sequelize.col('clicked_count')), 'clicked_count']
        ],
        group: ['status'],
        raw: true
      });

      return res.json(ApiResponse.success('Email campaign statistics retrieved successfully', { stats }));
    }

    // Per-campaign stats route: /api/email-campaigns/:id/stats
    const stats = await emailCampaignService.getStats(campaignId);
    res.json(ApiResponse.success('Campaign statistics retrieved successfully', { stats }));
  })
};

module.exports = emailCampaignController;
