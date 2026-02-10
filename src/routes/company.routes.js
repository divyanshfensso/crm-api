const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET /stats - Must be before /:id to avoid matching "stats" as an ID
router.get('/stats', auth, checkPermission('companies', 'read'), companyController.getStats);

// GET / - Get all companies
router.get('/', auth, checkPermission('companies', 'read'), companyController.getAll);

// GET /:id - Get company by ID
router.get('/:id', auth, checkPermission('companies', 'read'), companyController.getById);

// POST / - Create new company
router.post('/', auth, checkPermission('companies', 'create'), companyController.create);

// PUT /:id - Update company
router.put('/:id', auth, checkPermission('companies', 'update'), companyController.update);

// DELETE /:id - Delete company
router.delete('/:id', auth, checkPermission('companies', 'delete'), companyController.delete);

module.exports = router;
