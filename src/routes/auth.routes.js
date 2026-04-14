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

// Public routes — rate limited to block brute-force attacks
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/verify-user/:token/:action', verifyUser);
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordHandler);
router.post('/reset-password/:token', resetPasswordLimiter, resetPasswordHandler);

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
