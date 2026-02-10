const { User, Role, Permission } = require('../models');
const ApiResponse = require('../utils/apiResponse');

const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json(ApiResponse.error('Authentication required'));
      }

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
        return res.status(401).json(ApiResponse.error('User not found'));
      }

      // Check if user has the required permission
      let hasPermission = false;
      if (user.roles) {
        for (const role of user.roles) {
          // Super Admin has all permissions
          if (role.name === 'Super Admin') {
            hasPermission = true;
            break;
          }
          if (role.permissions) {
            for (const perm of role.permissions) {
              if (perm.module === module && perm.action === action) {
                hasPermission = true;
                break;
              }
            }
          }
          if (hasPermission) break;
        }
      }

      if (!hasPermission) {
        return res.status(403).json(ApiResponse.error('You do not have permission to perform this action'));
      }

      // Attach user roles and permissions to request
      req.userRoles = user.roles.map(r => r.name);
      req.userPermissions = [];
      user.roles.forEach(role => {
        if (role.permissions) {
          role.permissions.forEach(perm => {
            const permStr = `${perm.module}:${perm.action}`;
            if (!req.userPermissions.includes(permStr)) {
              req.userPermissions.push(permStr);
            }
          });
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user has any of the specified roles
const checkRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json(ApiResponse.error('Authentication required'));
      }

      const user = await User.findByPk(req.user.id, {
        include: [{
          model: Role,
          as: 'roles',
          through: { attributes: [] },
        }],
      });

      if (!user) {
        return res.status(401).json(ApiResponse.error('User not found'));
      }

      const userRoles = user.roles.map(r => r.name);
      const hasRole = roles.some(role => userRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json(ApiResponse.error('Insufficient role permissions'));
      }

      req.userRoles = userRoles;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { checkPermission, checkRole };
