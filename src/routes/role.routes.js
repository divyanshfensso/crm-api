const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRoleSchema, updateRoleSchema } = require('../utils/validators');

router.get('/', auth, checkPermission('roles', 'read'), roleController.getAll);
router.post('/', auth, checkPermission('roles', 'create'), validate(createRoleSchema), roleController.create);

// Permissions route BEFORE /:id to prevent "permissions" matching as :id
router.get('/permissions/all', auth, checkPermission('roles', 'read'), roleController.getAllPermissions);

// AI suggest permissions (static route BEFORE /:id)
router.post('/suggest-permissions', auth, checkPermission('roles', 'create'), roleController.suggestPermissions);

router.get('/:id', auth, checkPermission('roles', 'read'), roleController.getById);
router.put('/:id', auth, checkPermission('roles', 'update'), validate(updateRoleSchema), roleController.update);
router.put('/:id/permissions', auth, checkPermission('roles', 'update'), roleController.updatePermissions);
router.delete('/:id', auth, checkPermission('roles', 'delete'), roleController.delete);

module.exports = router;
