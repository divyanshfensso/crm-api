const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authService = require('./auth.service');
const ApiError = require('../utils/apiError');

const SSO_SECRET = process.env.SSO_SECRET;

// Role mapping: Nucleus → CRM
const ROLE_MAP = {
  superAdmin: 'Super Admin',
  admin: 'Admin',
  default: 'Sales Rep',
};

const ssoService = {
  /**
   * Verify an SSO token from Nucleus.
   * Returns the decoded payload.
   */
  verifySsoToken: (token) => {
    if (!SSO_SECRET) {
      throw ApiError.internal('SSO is not configured');
    }
    try {
      return jwt.verify(token, SSO_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('SSO token has expired. Please try again from Nucleus.');
      }
      throw ApiError.unauthorized('Invalid SSO token');
    }
  },

  /**
   * Map Nucleus user data to a CRM role name.
   */
  mapNucleusRoleToCrm: (payload) => {
    if (payload.is_super_admin === 1) return ROLE_MAP.superAdmin;
    if (payload.is_manager === 1 || payload.role === 'Admin') return ROLE_MAP.admin;
    return ROLE_MAP.default;
  },

  /**
   * Find an existing CRM user by email, or create a new one.
   * Returns a fully-loaded user with roles and permissions, plus tokens.
   */
  findOrCreateUser: async (payload) => {
    const { User, Role, Permission } = require('../models');

    const userInclude = [{
      model: Role,
      as: 'roles',
      through: { attributes: [] },
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      }],
    }];

    // Try to find existing user by email
    let user = await User.findOne({
      where: { email: payload.email },
      include: userInclude,
    });

    if (user) {
      // Existing user — check status
      if (user.status !== 'active') {
        throw ApiError.unauthorized('Your CRM account is not active. Please contact the CRM administrator.');
      }
    } else {
      // Create new user
      const nameParts = (payload.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '-';

      // SSO users get a random password hash (they don't login via password)
      const dummyPassword = await authService.hashPassword(crypto.randomUUID());

      user = await User.create({
        email: payload.email,
        password_hash: dummyPassword,
        first_name: firstName,
        last_name: lastName,
        status: 'active',
        email_verified: true,
      });

      // Assign mapped CRM role
      const crmRoleName = ssoService.mapNucleusRoleToCrm(payload);
      const role = await Role.findOne({ where: { name: crmRoleName } });
      if (role) {
        await user.addRole(role);
      } else {
        // Fallback to Sales Rep
        const fallbackRole = await Role.findOne({ where: { name: 'Sales Rep' } });
        if (fallbackRole) {
          await user.addRole(fallbackRole);
        }
      }

      // Reload with associations
      user = await User.findOne({
        where: { id: user.id },
        include: userInclude,
      });
    }

    // Generate CRM tokens
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    await user.update({ refresh_token: refreshToken, last_login: new Date() });

    // Extract roles and permissions
    const roles = [];
    const permissions = [];
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

    return {
      user: user.toSafeObject(),
      roles,
      permissions,
      accessToken,
      refreshToken,
    };
  },
};

module.exports = ssoService;
