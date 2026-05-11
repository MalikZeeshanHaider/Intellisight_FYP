import asyncHandler from 'express-async-handler';
import {
  registerUser,
  registerAdmin,
  loginAdmin,
  verifyUserRegistration,
  forgotPassword,
  resetPassword,
  getPendingUsers,
  getAdminStatistics,
  getAllAdmins,
  approvePendingUser,
  rejectPendingUser,
  deleteAdminUser,
  addUserByAdmin,
  getAdminPermissions,
} from '../services/auth.service.js';
import { successResponse } from '../utils/response.js';

/**
 * @desc    Register new user (requires admin approval)
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const result = await registerUser({ name, email, password });

  return successResponse(res, result, 'Registration request submitted successfully');
});

/**
 * @desc    Register new admin (direct registration for admins)
 * @route   POST /api/auth/register-admin
 * @access  Private/Admin
 */
export const registerAdminDirect = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const result = await registerAdmin({ name, email, password, role: role || 'Admin' });

  return successResponse(res, result, 'Admin registered successfully', 201);
});

/**
 * @desc    Verify user registration (approve/reject)
 * @route   GET /api/auth/verify-user/:token/:action
 * @access  Public (link from email)
 */
export const verifyUser = asyncHandler(async (req, res) => {
  const { token, action } = req.params;

  const result = await verifyUserRegistration(token, action);

  // Send HTML response for email link clicks
  const htmlResponse = action === 'approve' 
    ? `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Approved - IntelliSight</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          .success-icon {
            font-size: 60px;
            color: #28a745;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin: 0 0 20px 0;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin: 15px 0;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>User Approved Successfully!</h1>
          <p>The user has been approved and can now log in to IntelliSight.</p>
          <p>An approval email has been sent to the user.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard" class="btn">Back to Dashboard</a>
        </div>
      </body>
      </html>
    `
    : `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Rejected - IntelliSight</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          .warning-icon {
            font-size: 60px;
            color: #dc3545;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin: 0 0 20px 0;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin: 15px 0;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="warning-icon">✗</div>
          <h1>User Registration Rejected</h1>
          <p>The user registration request has been rejected.</p>
          <p>A rejection email has been sent to the user.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard" class="btn">Back to Dashboard</a>
        </div>
      </body>
      </html>
    `;

  res.status(200).send(htmlResponse);
});

/**
 * @desc    Login user/admin
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await loginAdmin({ email, password });

  // Set JWT in httpOnly cookie — invisible to JavaScript, immune to XSS
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', result.token, {
    httpOnly: true,               // JS cannot read this cookie
    secure: isProduction,         // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms (matches JWT_EXPIRES_IN)
    path: '/',
  });

  // Return admin info but NOT the token — client never needs to store it
  const { token: _omit, ...safeResult } = result;
  return successResponse(res, safeResult, 'Login successful');
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear the httpOnly cookie by overwriting it with an expired one
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' });
  return successResponse(res, {}, 'Logged out successfully');
});

/**
 * @desc    Forgot password - send reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPasswordHandler = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await forgotPassword(email);

  return successResponse(res, result, 'Password reset link sent');
});

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPasswordHandler = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const result = await resetPassword(token, password);

  return successResponse(res, result, 'Password reset successful');
});

/**
 * @desc    Get all pending users
 * @route   GET /api/auth/pending-users
 * @access  Private/Admin
 */
export const getPendingUsersHandler = asyncHandler(async (req, res) => {
  const pendingUsers = await getPendingUsers();

  return successResponse(res, { users: pendingUsers, count: pendingUsers.length }, 'Pending users retrieved successfully');
});

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const permissions = await getAdminPermissions(req.user.adminId);
  return successResponse(res, { user: { ...req.user, permissions } }, 'User retrieved successfully');
});

/**
 * @desc    Get admin statistics (Super Admin only)
 * @route   GET /api/auth/admin/statistics
 * @access  Private/SuperAdmin
 */
export const getStatistics = asyncHandler(async (req, res) => {
  const statistics = await getAdminStatistics();
  return successResponse(res, statistics, 'Statistics retrieved successfully');
});

/**
 * @desc    Get all admins (Super Admin only)
 * @route   GET /api/auth/admin/all
 * @access  Private/SuperAdmin
 */
export const getAllAdminsHandler = asyncHandler(async (req, res) => {
  const admins = await getAllAdmins();
  return successResponse(res, { admins, count: admins.length }, 'Admins retrieved successfully');
});

/**
 * @desc    Approve pending user (Super Admin only)
 * @route   POST /api/auth/admin/approve/:userId
 * @access  Private/SuperAdmin
 */
export const approveUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await approvePendingUser(userId);
  return successResponse(res, result, 'User approved successfully');
});

/**
 * @desc    Reject pending user (Super Admin only)
 * @route   POST /api/auth/admin/reject/:userId
 * @access  Private/SuperAdmin
 */
export const rejectUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const result = await rejectPendingUser(userId, reason);
  return successResponse(res, result, 'User rejected successfully');
});

/**
 * @desc    Delete admin user (Super Admin only)
 * @route   DELETE /api/auth/admin/:adminId
 * @access  Private/SuperAdmin
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;
  const result = await deleteAdminUser(adminId);
  return successResponse(res, result, 'Admin deleted successfully');
});

/**
 * @desc    Add user directly (Super Admin only)
 * @route   POST /api/auth/admin/add-user
 * @access  Private/SuperAdmin
 */
export const addUser = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const result = await addUserByAdmin({ name, email });
  return successResponse(res, result, 'User added successfully', 201);
});
