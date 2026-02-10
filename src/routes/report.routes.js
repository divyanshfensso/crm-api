const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET / - Get all reports
router.get('/', auth, checkPermission('reports', 'read'), reportController.getAll);

// POST / - Create new report
router.post('/', auth, checkPermission('reports', 'create'), reportController.create);

// GET /:id - Get report by ID
router.get('/:id', auth, checkPermission('reports', 'read'), reportController.getById);

// PUT /:id - Update report
router.put('/:id', auth, checkPermission('reports', 'update'), reportController.update);

// DELETE /:id - Delete report
router.delete('/:id', auth, checkPermission('reports', 'delete'), reportController.delete);

// POST /:id/execute - Execute report (dynamic query)
router.post('/:id/execute', auth, checkPermission('reports', 'read'), reportController.executeReport);

// POST /:id/export - Export report as CSV or JSON
router.post('/:id/export', auth, checkPermission('reports', 'export'), reportController.exportReport);

module.exports = router;
