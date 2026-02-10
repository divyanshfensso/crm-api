const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, updateUserSchema, changePasswordSchema } = require('../utils/validators');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);

// Profile routes
router.get('/me', auth, authController.getMe);
router.put('/me', auth, validate(updateUserSchema), authController.updateMe);
router.put('/me/password', auth, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
