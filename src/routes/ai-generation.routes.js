const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const aiGenerationController = require('../controllers/ai-generation.controller');

// All AI routes require auth + knowledge_base:create permission
router.post('/generate', auth, checkPermission('knowledge_base', 'create'), aiGenerationController.generate);
router.post('/enhance', auth, checkPermission('knowledge_base', 'create'), aiGenerationController.enhance);
router.post('/append', auth, checkPermission('knowledge_base', 'create'), aiGenerationController.append);

module.exports = router;
