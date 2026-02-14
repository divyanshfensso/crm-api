const kbArticleService = require('../services/kb-article.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const kbArticleController = {
  /**
   * Upload image for KB article editor
   * POST /api/knowledge-base/articles/upload-image
   */
  uploadImage: asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No image file uploaded');
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json(ApiResponse.success('Image uploaded successfully', { url: imageUrl }));
  }),

  /**
   * Get all articles with pagination, search, and filters
   * GET /api/knowledge-base/articles
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await kbArticleService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Articles retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get article by ID
   * GET /api/knowledge-base/articles/:id
   */
  getById: asyncHandler(async (req, res) => {
    const article = await kbArticleService.getById(req.params.id);
    res.json(ApiResponse.success('Article retrieved successfully', { article }));
  }),

  /**
   * Create a new article
   * POST /api/knowledge-base/articles
   */
  create: asyncHandler(async (req, res) => {
    const article = await kbArticleService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'KNOWLEDGE_BASE',
      article.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Article created successfully', { article }));
  }),

  /**
   * Update an existing article
   * PUT /api/knowledge-base/articles/:id
   */
  update: asyncHandler(async (req, res) => {
    const article = await kbArticleService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'KNOWLEDGE_BASE',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Article updated successfully', { article }));
  }),

  /**
   * Delete an article (soft delete)
   * DELETE /api/knowledge-base/articles/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await kbArticleService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'KNOWLEDGE_BASE',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Article deleted successfully', result));
  }),

  /**
   * Publish an article
   * POST /api/knowledge-base/articles/:id/publish
   */
  publish: asyncHandler(async (req, res) => {
    const article = await kbArticleService.publish(req.params.id);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'KNOWLEDGE_BASE',
      parseInt(req.params.id),
      null,
      { status: 'published' },
      req
    );

    res.json(ApiResponse.success('Article published successfully', { article }));
  }),

  /**
   * Add feedback to an article
   * POST /api/knowledge-base/articles/:id/feedback
   */
  addFeedback: asyncHandler(async (req, res) => {
    const feedback = await kbArticleService.addFeedback(req.params.id, req.body, req.user.id);
    res.status(201).json(ApiResponse.created('Feedback added successfully', { feedback }));
  }),

  /**
   * Search published articles
   * GET /api/knowledge-base/articles/search
   */
  search: asyncHandler(async (req, res) => {
    const result = await kbArticleService.search(req.query);
    res.json(ApiResponse.paginated(
      'Search results retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),
  /**
   * Toggle public sharing for an article
   * POST /api/knowledge-base/articles/:id/toggle-public
   */
  togglePublic: asyncHandler(async (req, res) => {
    const article = await kbArticleService.togglePublic(req.params.id);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'KNOWLEDGE_BASE',
      parseInt(req.params.id),
      null,
      { is_public: article.is_public },
      req
    );

    res.json(ApiResponse.success(
      article.is_public ? 'Article is now publicly accessible' : 'Article is now private',
      { article }
    ));
  }),

  /**
   * Get a public article by share token (no auth required)
   * GET /api/knowledge-base/public/:shareToken
   */
  getByShareToken: asyncHandler(async (req, res) => {
    const article = await kbArticleService.getByShareToken(req.params.shareToken);
    res.json(ApiResponse.success('Public article retrieved successfully', { article }));
  }),
};

module.exports = kbArticleController;
