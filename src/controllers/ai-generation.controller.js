const aiGenerationService = require('../services/ai-generation.service');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const aiGenerationController = {
  /**
   * Generate a complete article from a topic
   * POST /api/knowledge-base/ai/generate
   */
  generate: asyncHandler(async (req, res) => {
    const { topic, tone } = req.body;

    if (!topic || !topic.trim()) {
      throw ApiError.badRequest('Topic is required');
    }

    const result = await aiGenerationService.generateArticle(topic.trim(), tone || 'professional');

    res.json(ApiResponse.success('Article generated successfully', result));
  }),

  /**
   * Enhance existing article content
   * POST /api/knowledge-base/ai/enhance
   */
  enhance: asyncHandler(async (req, res) => {
    const { content, instructions } = req.body;

    if (!content || !content.trim()) {
      throw ApiError.badRequest('Content is required for enhancement');
    }

    const result = await aiGenerationService.enhanceContent(
      content.trim(),
      instructions || 'Improve grammar, structure, and clarity'
    );

    res.json(ApiResponse.success('Content enhanced successfully', result));
  }),

  /**
   * Generate content to append to existing article
   * POST /api/knowledge-base/ai/append
   */
  append: asyncHandler(async (req, res) => {
    const { content, instructions } = req.body;

    if (!instructions || !instructions.trim()) {
      throw ApiError.badRequest('Instructions are required');
    }

    const result = await aiGenerationService.appendContent(
      content || '',
      instructions.trim()
    );

    res.json(ApiResponse.success('Content generated successfully', result));
  }),
};

module.exports = aiGenerationController;
