const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const aiService = require('../services/ai.service');

const aiController = {
  /**
   * Test AI connection
   * POST /api/ai/test-connection
   */
  testConnection: asyncHandler(async (req, res) => {
    const result = await aiService.testConnection();
    res.json(ApiResponse.success('AI connection successful', result));
  }),

  /**
   * Generate email template
   * POST /api/ai/email-template/generate
   */
  generateEmailTemplate: asyncHandler(async (req, res) => {
    const { purpose, module, tone, keyPoints } = req.body;

    if (!purpose || !module || !tone) {
      throw ApiError.badRequest('Purpose, module, and tone are required');
    }

    const result = await aiService.generateEmailTemplate(purpose, module, tone, keyPoints);
    res.json(ApiResponse.success('Email template generated', result));
  }),

  /**
   * Score leads with AI
   * POST /api/ai/leads/score
   */
  scoreLeads: asyncHandler(async (req, res) => {
    const { leadIds } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      throw ApiError.badRequest('leadIds array is required');
    }

    if (leadIds.length > 50) {
      throw ApiError.badRequest('Maximum 50 leads can be scored at once');
    }

    const result = await aiService.scoreLeads(leadIds);
    res.json(ApiResponse.success(`Successfully scored ${result.scored} of ${result.total} leads`, result));
  }),

  /**
   * Analyze deal
   * POST /api/ai/deals/:id/analyze
   */
  analyzeDeal: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await aiService.analyzeDeal(id);
    res.json(ApiResponse.success('Deal analysis complete', result));
  }),

  /**
   * Summarize contact
   * POST /api/ai/contacts/:id/summarize
   */
  summarizeContact: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await aiService.summarizeContact(id);
    res.json(ApiResponse.success('Contact summary generated', result));
  }),

  /**
   * Summarize company
   * POST /api/ai/companies/:id/summarize
   */
  summarizeCompany: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await aiService.summarizeCompany(id);
    res.json(ApiResponse.success('Company summary generated', result));
  }),

  /**
   * Suggest email subject lines
   * POST /api/ai/email/suggest-subjects
   */
  suggestSubjectLines: asyncHandler(async (req, res) => {
    const { body, module, purpose } = req.body;
    const result = await aiService.suggestSubjectLines(body, module, purpose);
    res.json(ApiResponse.success('Subject line suggestions generated', result));
  }),

  /**
   * Get dashboard AI insights
   * GET /api/ai/dashboard/insights
   */
  getDashboardInsights: asyncHandler(async (req, res) => {
    const result = await aiService.getDashboardInsights();
    res.json(ApiResponse.success('Dashboard insights generated', result));
  }),

  /**
   * Parse natural language report query
   * POST /api/ai/reports/parse-query
   */
  parseReportQuery: asyncHandler(async (req, res) => {
    const { query } = req.body;

    if (!query || query.trim().length < 5) {
      throw ApiError.badRequest('Please provide a more detailed query');
    }

    const result = await aiService.parseReportQuery(query);
    res.json(ApiResponse.success('Report query parsed', result));
  }),

  /**
   * Analyze CSV for smart import — detect entity, map columns, suggest transforms
   * POST /api/ai/import/analyze
   */
  analyzeImportCSV: asyncHandler(async (req, res) => {
    const { headers, sampleRows, entityTypeHint } = req.body;

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      throw ApiError.badRequest('CSV headers are required');
    }

    if (!sampleRows || !Array.isArray(sampleRows) || sampleRows.length === 0) {
      throw ApiError.badRequest('Sample data rows are required');
    }

    const result = await aiService.analyzeImportCSV(
      headers,
      sampleRows.slice(0, 5),
      entityTypeHint || null
    );
    res.json(ApiResponse.success('Import analysis complete', result));
  }),

  /**
   * Summarize activities
   * POST /api/ai/activities/summarize
   */
  summarizeActivities: asyncHandler(async (req, res) => {
    const { entity_type, entity_id } = req.body;

    if (!entity_type || !entity_id) {
      throw ApiError.badRequest('entity_type and entity_id are required');
    }

    const result = await aiService.summarizeActivities(entity_type, entity_id);
    res.json(ApiResponse.success('Activity summary generated', result));
  }),
};

module.exports = aiController;
