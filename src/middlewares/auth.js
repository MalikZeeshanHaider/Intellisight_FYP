import { verifyToken } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import { ERROR_MESSAGES } from '../config/constants.js';

/**
 * Middleware to authenticate JWT token.
 * Priority: httpOnly cookie → Authorization header (for API clients / Postman).
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // 1. Prefer the httpOnly cookie (browser sessions)
    let token = req.cookies?.token;

    // 2. Fall back to Authorization header (Postman / server-to-server)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_REQUIRED);
    }

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
 * Middleware to check if the user has a specific permission key.
 * SuperAdmins (isSuperAdmin=true) pass unconditionally.
 * For regular admins, permissions are re-fetched from the DB on each call
 * so that role changes take effect without requiring a new login.
 */
export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError(ERROR_MESSAGES.UNAUTHORIZED);
      if (req.user.isSuperAdmin) return next();

      const { getAdminPermissions } = await import('../services/auth.service.js');
      const keys = await getAdminPermissions(req.user.adminId);
      if (!keys.includes(permissionKey)) {
        throw new UnauthorizedError(`Permission required: ${permissionKey}`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication - doesn't fail if no token.
 * Cookie takes priority over Authorization header.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
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
