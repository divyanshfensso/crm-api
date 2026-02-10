const authService = require('../services/auth.service');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const authController = {
  register: async (req, res, next) => {
    try {
      const user = await authService.register(req.body);

      await createAuditLog(null, 'register', 'auth', user.id, null, { email: user.email }, req);

      res.status(201).json(ApiResponse.success('Registration successful', { user }));
    } catch (error) {
      next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      await createAuditLog(result.user.id, 'login', 'auth', result.user.id, null, null, req);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json(ApiResponse.success('Login successful', {
        user: result.user,
        roles: result.roles,
        permissions: result.permissions,
        accessToken: result.accessToken,
      }));
    } catch (error) {
      next(error);
    }
  },

  refresh: async (req, res, next) => {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;
      if (!token) {
        return res.status(401).json(ApiResponse.error('Refresh token required'));
      }

      const result = await authService.refreshToken(token);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json(ApiResponse.success('Token refreshed', {
        user: result.user,
        roles: result.roles,
        permissions: result.permissions,
        accessToken: result.accessToken,
      }));
    } catch (error) {
      next(error);
    }
  },

  logout: async (req, res, next) => {
    try {
      if (req.user) {
        await authService.logout(req.user.id);
        await createAuditLog(req.user.id, 'logout', 'auth', req.user.id, null, null, req);
      }

      res.clearCookie('refreshToken');
      res.json(ApiResponse.success('Logged out successfully'));
    } catch (error) {
      next(error);
    }
  },

  getMe: async (req, res, next) => {
    try {
      const { User, Role, Permission } = require('../models');

      const user = await User.findByPk(req.user.id, {
        include: [{
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          include: [{
            model: Permission,
            as: 'permissions',
            through: { attributes: [] },
          }],
        }],
      });

      if (!user) {
        return res.status(404).json(ApiResponse.error('User not found'));
      }

      const permissions = [];
      const roles = [];
      if (user.roles) {
        user.roles.forEach(role => {
          roles.push(role.name);
          if (role.permissions) {
            role.permissions.forEach(perm => {
              const permStr = `${perm.module}:${perm.action}`;
              if (!permissions.includes(permStr)) {
                permissions.push(permStr);
              }
            });
          }
        });
      }

      res.json(ApiResponse.success('Profile retrieved', {
        user: user.toSafeObject(),
        roles,
        permissions,
      }));
    } catch (error) {
      next(error);
    }
  },

  updateMe: async (req, res, next) => {
    try {
      const { User } = require('../models');
      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json(ApiResponse.error('User not found'));
      }

      const oldValues = { first_name: user.first_name, last_name: user.last_name, phone: user.phone };

      const { firstName, lastName, phone } = req.body;
      await user.update({
        ...(firstName && { first_name: firstName }),
        ...(lastName && { last_name: lastName }),
        ...(phone !== undefined && { phone }),
      });

      await createAuditLog(req.user.id, 'update', 'users', user.id, oldValues, req.body, req);

      res.json(ApiResponse.success('Profile updated', { user: user.toSafeObject() }));
    } catch (error) {
      next(error);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      const { User } = require('../models');
      const user = await User.findByPk(req.user.id);

      const isMatch = await authService.comparePassword(req.body.currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json(ApiResponse.error('Current password is incorrect'));
      }

      const password_hash = await authService.hashPassword(req.body.newPassword);
      await user.update({ password_hash });

      await createAuditLog(req.user.id, 'change_password', 'auth', user.id, null, null, req);

      res.json(ApiResponse.success('Password changed successfully'));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
