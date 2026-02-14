const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const kbCategoryController = require('../controllers/kb-category.controller');
const kbArticleController = require('../controllers/kb-article.controller');
const aiGenerationRoutes = require('./ai-generation.routes');
const upload = require('../middleware/upload');

// Public article access (NO auth required)
router.get('/public/:shareToken', kbArticleController.getByShareToken);

// AI generation sub-router
router.use('/ai', aiGenerationRoutes);

// Categories
router.get('/categories', auth, checkPermission('knowledge_base', 'read'), kbCategoryController.getAll);
router.post('/categories', auth, checkPermission('knowledge_base', 'create'), kbCategoryController.create);
router.get('/categories/:id', auth, checkPermission('knowledge_base', 'read'), kbCategoryController.getById);
router.put('/categories/:id', auth, checkPermission('knowledge_base', 'update'), kbCategoryController.update);
router.delete('/categories/:id', auth, checkPermission('knowledge_base', 'delete'), kbCategoryController.delete);
router.put('/categories/:id/reorder', auth, checkPermission('knowledge_base', 'update'), kbCategoryController.reorder);

// Articles — static routes first
router.post('/articles/upload-image', auth, checkPermission('knowledge_base', 'create'), upload.single('image'), kbArticleController.uploadImage);
router.get('/articles/search', auth, checkPermission('knowledge_base', 'read'), kbArticleController.search);
router.get('/articles', auth, checkPermission('knowledge_base', 'read'), kbArticleController.getAll);
router.post('/articles', auth, checkPermission('knowledge_base', 'create'), kbArticleController.create);
router.get('/articles/:id', auth, checkPermission('knowledge_base', 'read'), kbArticleController.getById);
router.put('/articles/:id', auth, checkPermission('knowledge_base', 'update'), kbArticleController.update);
router.delete('/articles/:id', auth, checkPermission('knowledge_base', 'delete'), kbArticleController.delete);
router.post('/articles/:id/publish', auth, checkPermission('knowledge_base', 'update'), kbArticleController.publish);
router.post('/articles/:id/toggle-public', auth, checkPermission('knowledge_base', 'update'), kbArticleController.togglePublic);
router.post('/articles/:id/feedback', auth, checkPermission('knowledge_base', 'read'), kbArticleController.addFeedback);

module.exports = router;
