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

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify-user/:token/:action', verifyUser);
router.post('/forgot-password', forgotPasswordHandler);
router.post('/reset-password/:token', resetPasswordHandler);

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
