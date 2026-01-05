import { verifyToken } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import { ERROR_MESSAGES } from '../config/constants.js';

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_REQUIRED);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      isSuperAdmin: decoded.isSuperAdmin || false
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user is super admin
 */
export const requireSuperAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError(ERROR_MESSAGES.UNAUTHORIZED);
    }

    if (!req.user.isSuperAdmin || req.user.role !== 'SuperAdmin') {
      throw new UnauthorizedError('Super admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError(ERROR_MESSAGES.UNAUTHORIZED);
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new UnauthorizedError(ERROR_MESSAGES.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      req.user = {
        adminId: decoded.adminId,
        email: decoded.email,
        role: decoded.role,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
