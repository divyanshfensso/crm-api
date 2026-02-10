const kbCategoryService = require('../services/kb-category.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const kbCategoryController = {
  /**
   * Get all categories (tree or flat list)
   * GET /api/knowledge-base/categories
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await kbCategoryService.getAll(req.query);

    if (result.meta) {
      res.json(ApiResponse.paginated(
        'Categories retrieved successfully',
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.total
      ));
    } else {
      res.json(ApiResponse.success('Categories retrieved successfully', { categories: result.data }));
    }
  }),

  /**
   * Get category by ID
   * GET /api/knowledge-base/categories/:id
   */
  getById: asyncHandler(async (req, res) => {
    const category = await kbCategoryService.getById(req.params.id);
    res.json(ApiResponse.success('Category retrieved successfully', { category }));
  }),

  /**
   * Create a new category
   * POST /api/knowledge-base/categories
   */
  create: asyncHandler(async (req, res) => {
    const category = await kbCategoryService.create(req.body);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'KNOWLEDGE_BASE',
      category.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Category created successfully', { category }));
  }),

  /**
   * Update an existing category
   * PUT /api/knowledge-base/categories/:id
   */
  update: asyncHandler(async (req, res) => {
    const category = await kbCategoryService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'KNOWLEDGE_BASE',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Category updated successfully', { category }));
  }),

  /**
   * Delete a category (soft delete)
   * DELETE /api/knowledge-base/categories/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await kbCategoryService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'KNOWLEDGE_BASE',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Category deleted successfully', result));
  }),

  /**
   * Reorder a category
   * PUT /api/knowledge-base/categories/:id/reorder
   */
  reorder: asyncHandler(async (req, res) => {
    const { position } = req.body;
    const category = await kbCategoryService.reorder(req.params.id, position);
    res.json(ApiResponse.success('Category reordered successfully', { category }));
  }),
};

module.exports = kbCategoryController;
