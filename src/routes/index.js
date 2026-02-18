const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const settingsRoutes = require('./settings.routes');
const contactRoutes = require('./contact.routes');
const companyRoutes = require('./company.routes');
const leadRoutes = require('./lead.routes');
const dealRoutes = require('./deal.routes');
const activityRoutes = require('./activity.routes');
const dashboardRoutes = require('./dashboard.routes');
const pipelineRoutes = require('./pipeline.routes');
const taskRoutes = require('./task.routes');
const documentRoutes = require('./document.routes');
const calendarRoutes = require('./calendar.routes');
const quoteRoutes = require('./quote.routes');
const invoiceRoutes = require('./invoice.routes');
const paymentRoutes = require('./payment.routes');
const emailTemplateRoutes = require('./email-template.routes');
const emailLogRoutes = require('./email-log.routes');

// Phase 4 routes
const reportRoutes = require('./report.routes');
const dataExportRoutes = require('./data-export.routes');
const importRoutes = require('./import.routes');
const emailCampaignRoutes = require('./email-campaign.routes');
const apiKeyRoutes = require('./api-key.routes');
const webhookRoutes = require('./webhook.routes');
const knowledgeBaseRoutes = require('./knowledge-base.routes');
const workflowRoutes = require('./workflow.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/settings', settingsRoutes);
router.use('/contacts', contactRoutes);
router.use('/companies', companyRoutes);
router.use('/leads', leadRoutes);
router.use('/deals', dealRoutes);
router.use('/activities', activityRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/pipelines', pipelineRoutes);
router.use('/tasks', taskRoutes);
router.use('/documents', documentRoutes);
router.use('/calendar', calendarRoutes);
router.use('/quotes', quoteRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/email-templates', emailTemplateRoutes);
router.use('/email-logs', emailLogRoutes);

// Phase 4 routes
router.use('/reports', reportRoutes);
router.use('/data-exports', dataExportRoutes);
router.use('/imports', importRoutes);
router.use('/email-campaigns', emailCampaignRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/knowledge-base', knowledgeBaseRoutes);
router.use('/workflows', workflowRoutes);

// Phase 5 routes
const forecastRoutes = require('./forecast.routes');
const googleIntegrationRoutes = require('./google-integration.routes');
const microsoftIntegrationRoutes = require('./microsoft-integration.routes');
router.use('/forecast', forecastRoutes);
router.use('/integrations/google', googleIntegrationRoutes);
router.use('/integrations/microsoft', microsoftIntegrationRoutes);

// Phase 6 — AI routes
const aiRoutes = require('./ai.routes');
router.use('/ai', aiRoutes);

// Custom fields
const customFieldRoutes = require('./customField.routes');
router.use('/custom-fields', customFieldRoutes);

// Notification routes
const notificationRoutes = require('./notification.routes');
router.use('/notifications', notificationRoutes);

module.exports = router;
