import express from 'express';
import {
  register,
  registerAdminDirect,
  login,
  logout,
  verifyUser,
  forgotPasswordHandler,
  resetPasswordHandler,
  getPendingUsersHandler,
  getCurrentUser,
  getStatistics,
  getAllAdminsHandler,
  approveUser,
  rejectUser,
  deleteAdmin,
  addUser
} from '../controllers/auth.controller.js';
import { authenticateToken, requireRole, requireSuperAdmin } from '../middlewares/auth.js';
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from '../middlewares/rateLimiter.js';

const router = express.Router();
const IS_DEV = process.env.NODE_ENV !== 'production';

// Public routes — rate limiters only applied in production
router.post('/register',        ...(IS_DEV ? [] : [registerLimiter]),       register);
router.post('/login',           ...(IS_DEV ? [] : [loginLimiter]),          login);
router.get('/verify-user/:token/:action', verifyUser);
router.post('/forgot-password', ...(IS_DEV ? [] : [forgotPasswordLimiter]), forgotPasswordHandler);
router.post('/reset-password/:token', ...(IS_DEV ? [] : [resetPasswordLimiter]), resetPasswordHandler);

// Protected routes
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.get('/pending-users', authenticateToken, getPendingUsersHandler);

// Admin only routes
router.post('/register-admin', authenticateToken, requireRole('ADMIN'), registerAdminDirect);

// Super Admin only routes
router.get('/admin/statistics', authenticateToken, requireSuperAdmin, getStatistics);
router.get('/admin/all', authenticateToken, requireSuperAdmin, getAllAdminsHandler);
router.post('/admin/add-user', authenticateToken, requireSuperAdmin, addUser);
router.post('/admin/approve/:userId', authenticateToken, requireSuperAdmin, approveUser);
router.post('/admin/reject/:userId', authenticateToken, requireSuperAdmin, rejectUser);
router.delete('/admin/:adminId', authenticateToken, requireSuperAdmin, deleteAdmin);

export default router;
