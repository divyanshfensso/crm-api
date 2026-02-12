const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/email-template.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET / - Get all email templates
router.get('/', auth, checkPermission('email_templates', 'read'), emailTemplateController.getAll);

// POST /:id/send - Send email using template
router.post('/:id/send', auth, checkPermission('email_templates', 'create'), emailTemplateController.send);

// GET /:id - Get email template by ID
router.get('/:id', auth, checkPermission('email_templates', 'read'), emailTemplateController.getById);

// POST / - Create new email template
router.post('/', auth, checkPermission('email_templates', 'create'), emailTemplateController.create);

// PUT /:id - Update email template
router.put('/:id', auth, checkPermission('email_templates', 'update'), emailTemplateController.update);

// DELETE /:id - Delete email template
router.delete('/:id', auth, checkPermission('email_templates', 'delete'), emailTemplateController.delete);

module.exports = router;
