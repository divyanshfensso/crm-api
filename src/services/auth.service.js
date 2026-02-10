const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const ApiError = require('../utils/apiError');

// Helper: extract permissions and role names from user with includes
const extractUserAuth = (user) => {
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
  return { roles, permissions };
};

// Helper: standard user include with roles and permissions
const getUserInclude = () => {
  const { Role, Permission } = require('../models');
  return [{
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    include: [{
      model: Permission,
      as: 'permissions',
      through: { attributes: [] },
    }],
  }];
};

const authService = {
  hashPassword: async (password) => {
    return bcrypt.hash(password, 12);
  },

  comparePassword: async (password, hash) => {
    return bcrypt.compare(password, hash);
  },

  generateAccessToken: (user) => {
    return jwt.sign(
      { id: user.id, email: user.email },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
  },

  generateRefreshToken: (user) => {
    return jwt.sign(
      { id: user.id },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );
  },

  verifyAccessToken: (token) => {
    try {
      return jwt.verify(token, jwtConfig.secret);
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired access token');
    }
  },

  verifyRefreshToken: (token) => {
    try {
      return jwt.verify(token, jwtConfig.refreshSecret);
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  },

  register: async (userData) => {
    const { User, Role } = require('../models');

    const existing = await User.findOne({ where: { email: userData.email } });
    if (existing) {
      throw ApiError.badRequest('Email already registered');
    }

    const password_hash = await authService.hashPassword(userData.password);

    const user = await User.create({
      email: userData.email,
      password_hash,
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone || null,
    });

    // Assign default role (Sales Rep)
    const defaultRole = await Role.findOne({ where: { name: 'Sales Rep' } });
    if (defaultRole) {
      await user.addRole(defaultRole);
    }

    return user.toSafeObject();
  },

  login: async (email, password) => {
    const { User } = require('../models');

    const user = await User.findOne({
      where: { email },
      include: getUserInclude(),
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw ApiError.unauthorized('Account is not active. Please contact administrator.');
    }

    const isMatch = await authService.comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    await user.update({ refresh_token: refreshToken, last_login: new Date() });

    const { roles, permissions } = extractUserAuth(user);

    return {
      user: user.toSafeObject(),
      roles,
      permissions,
      accessToken,
      refreshToken,
    };
  },

  refreshToken: async (token) => {
    const { User } = require('../models');

    const decoded = authService.verifyRefreshToken(token);

    const user = await User.findOne({
      where: { id: decoded.id, refresh_token: token },
      include: getUserInclude(),
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const accessToken = authService.generateAccessToken(user);
    const newRefreshToken = authService.generateRefreshToken(user);

    await user.update({ refresh_token: newRefreshToken });

    const { roles, permissions } = extractUserAuth(user);

    return {
      user: user.toSafeObject(),
      roles,
      permissions,
      accessToken,
      refreshToken: newRefreshToken,
    };
  },

  logout: async (userId) => {
    const { User } = require('../models');
    await User.update({ refresh_token: null }, { where: { id: userId } });
  },
};

module.exports = authService;
