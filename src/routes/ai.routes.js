const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const aiController = require('../controllers/ai.controller');

// Test AI connection
router.post('/test-connection', auth, checkPermission('settings', 'read'), aiController.testConnection);

// Email template generation
router.post('/email-template/generate', auth, checkPermission('email_templates', 'create'), aiController.generateEmailTemplate);

// Lead scoring
router.post('/leads/score', auth, checkPermission('leads', 'update'), aiController.scoreLeads);

// Deal analysis
router.post('/deals/:id/analyze', auth, checkPermission('deals', 'read'), aiController.analyzeDeal);

// Contact summary
router.post('/contacts/:id/summarize', auth, checkPermission('contacts', 'read'), aiController.summarizeContact);

// Company summary
router.post('/companies/:id/summarize', auth, checkPermission('companies', 'read'), aiController.summarizeCompany);

// Email subject suggestions
router.post('/email/suggest-subjects', auth, checkPermission('email_templates', 'read'), aiController.suggestSubjectLines);

// Dashboard insights
router.get('/dashboard/insights', auth, checkPermission('dashboard', 'read'), aiController.getDashboardInsights);

// Report query parsing
router.post('/reports/parse-query', auth, checkPermission('reports', 'create'), aiController.parseReportQuery);

// Activity summarization
router.post('/activities/summarize', auth, checkPermission('activities', 'read'), aiController.summarizeActivities);

module.exports = router;
