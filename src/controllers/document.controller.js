const documentService = require('../services/document.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const documentController = {
  /**
   * Get all documents with pagination, search, and filters
   * GET /api/documents
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await documentService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Documents retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get document by ID
   * GET /api/documents/:id
   */
  getById: asyncHandler(async (req, res) => {
    const document = await documentService.getById(req.params.id);
    res.json(ApiResponse.success('Document retrieved successfully', { document }));
  }),

  /**
   * Create a new document (upload file)
   * POST /api/documents
   */
  create: asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No file uploaded');
    }

    const fileData = req.file;
    const metadata = req.body;

    const document = await documentService.create(fileData, metadata, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'DOCUMENT',
      document.id,
      null,
      { original_name: document.original_name, mime_type: document.mime_type },
      req
    );

    res.status(201).json(ApiResponse.created('Document uploaded successfully', { document }));
  }),

  /**
   * Download a document
   * GET /api/documents/:id/download
   */
  download: asyncHandler(async (req, res) => {
    const document = await documentService.getById(req.params.id);
    res.download(document.file_path, document.original_name);
  }),

  /**
   * Delete a document (soft delete + remove file)
   * DELETE /api/documents/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await documentService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'DOCUMENT',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Document deleted successfully', result));
  })
};

module.exports = documentController;
