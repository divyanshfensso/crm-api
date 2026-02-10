const authService = require('../services/auth.service');
const ApiResponse = require('../utils/apiResponse');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(ApiResponse.error('Access token required'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyAccessToken(token);

    const { User } = require('../models');
    const user = await User.findByPk(decoded.id);

    if (!user || user.status !== 'active') {
      return res.status(401).json(ApiResponse.error('User not found or inactive'));
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    return res.status(401).json(ApiResponse.error('Invalid or expired token'));
  }
};

// Optional auth - doesn't fail if no token, just sets req.user if valid
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyAccessToken(token);
      req.user = { id: decoded.id, email: decoded.email };
    }
  } catch (error) {
    // Token invalid, but that's ok for optional auth
  }
  next();
};

module.exports = { auth, optionalAuth };
