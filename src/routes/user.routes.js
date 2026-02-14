const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { registerSchema, updateUserSchema, paginationSchema } = require('../utils/validators');

router.post('/', auth, checkPermission('users', 'create'), validate(registerSchema), userController.create);
router.get('/', auth, checkPermission('users', 'read'), validate(paginationSchema, 'query'), userController.getAll);
router.get('/:id', auth, checkPermission('users', 'read'), userController.getById);
router.put('/:id', auth, checkPermission('users', 'update'), validate(updateUserSchema), userController.update);
router.put('/:id/status', auth, checkPermission('users', 'update'), userController.updateStatus);
router.delete('/:id', auth, checkPermission('users', 'delete'), userController.delete);

module.exports = router;
