import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Email configuration
const emailConfig = {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '221083@students.au.edu.pk',
    pass: process.env.EMAIL_PASS || 'afag ijik emzq blqo'
  }
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '221083@students.au.edu.pk';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// Super Admin Configuration
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'admin@123';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/**
 * Generate verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send email
 */
const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport(emailConfig);
  
  await transporter.sendMail({
    from: emailConfig.auth.user,
    to,
    subject,
    html
  });
};

/**
 * Register new admin
 */
export const registerAdmin = async ({ name, email, password, role }) => {
  // Check if email already exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { Email: email },
  });

  if (existingAdmin) {
    throw new ConflictError('Email already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create admin
  const admin = await prisma.admin.create({
    data: {
      Name: name,
      Email: email,
      Password: hashedPassword,
      Role: role,
    },
    select: {
      Admin_ID: true,
      Name: true,
      Email: true,
      Role: true,
    },
  });

  // Generate token
  const token = generateToken({
    adminId: admin.Admin_ID,
    email: admin.Email,
    role: admin.Role,
  });

  return { admin, token };
};

/**
 * Register new user (requires admin approval)
 */
export const registerUser = async ({ name, email, password }) => {
  // Validate password length
  if (!password || password.length < 8 || password.length > 16) {
    throw new Error('Password must be between 8 and 16 characters long');
  }

  // Check if email already exists in Admin table
  const existingAdmin = await prisma.admin.findUnique({
    where: { Email: email },
  });

  if (existingAdmin) {
    throw new ConflictError('Email already registered');
  }

  // Check if email is already pending
  const existingPending = await prisma.pendingUsers.findUnique({
    where: { Email: email },
  });

  if (existingPending && existingPending.Status === 'PENDING') {
    throw new ConflictError('Registration request already pending approval');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Generate verification token
  const verificationToken = generateVerificationToken();

  // Create pending user
  const pendingUser = await prisma.pendingUsers.create({
    data: {
      Name: name,
      Email: email,
      Password: hashedPassword,
      VerificationToken: verificationToken,
      Status: 'PENDING',
    },
  });

  // Send approval email to admin
  const approveLink = `${BACKEND_URL}/api/auth/verify-user/${verificationToken}/approve`;
  const rejectLink = `${BACKEND_URL}/api/auth/verify-user/${verificationToken}/reject`;

  const adminEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🔔 New User Registration</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">User Details</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 10px 0;"><strong>Requested At:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #666; line-height: 1.6;">A new user wants to register for IntelliSight system. Please review and take action:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${approveLink}" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 0 10px;">✓ Approve</a>
          <a href="${rejectLink}" style="background: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 0 10px;">✗ Reject</a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">IntelliSight - Facial Recognition System</p>
      </div>
    </div>
  `;

  await sendEmail(ADMIN_EMAIL, 'New User Registration Request - IntelliSight', adminEmailHtml);

  return { message: 'Registration request submitted. Awaiting admin approval. Check your email for updates.' };
};

/**
 * Verify user (admin approval/rejection)
 */
export const verifyUserRegistration = async (token, action, rejectionReason = null) => {
  // Find pending user by token
  const pendingUser = await prisma.pendingUsers.findUnique({
    where: { VerificationToken: token },
  });

  if (!pendingUser) {
    throw new NotFoundError('Invalid verification token');
  }

  if (pendingUser.Status !== 'PENDING') {
    throw new Error('This registration request has already been processed');
  }

  const { Name, Email, Password } = pendingUser;

  if (action === 'approve') {
    // Create admin account
    await prisma.admin.create({
      data: {
        Name,
        Email,
        Password,
        Role: 'User',
      },
    });

    // Update pending user status
    await prisma.pendingUsers.update({
      where: { VerificationToken: token },
      data: {
        Status: 'APPROVED',
        ProcessedAt: new Date(),
      },
    });

    // Send approval email to user
    const userEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to IntelliSight!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #28a745; margin-top: 0;">Registration Approved!</h2>
          <p style="color: #666; line-height: 1.6;">Hi <strong>${Name}</strong>,</p>
          <p style="color: #666; line-height: 1.6;">Great news! Your registration request has been approved by the administrator. You can now access the IntelliSight system.</p>
          <div style="background: #f0f8ff; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Your Account Details:</strong></p>
            <p style="margin: 5px 0;">Email: ${Email}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${FRONTEND_URL}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login Now</a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">IntelliSight - Facial Recognition System</p>
        </div>
      </div>
    `;

    await sendEmail(Email, 'Registration Approved - IntelliSight', userEmailHtml);

    return { message: 'User approved and account created successfully' };

  } else if (action === 'reject') {
    // Update pending user status
    await prisma.pendingUsers.update({
      where: { VerificationToken: token },
      data: {
        Status: 'REJECTED',
        ProcessedAt: new Date(),
        RejectionReason: rejectionReason || 'Registration request was not approved',
      },
    });

    // Send rejection email to user
    const userEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
        <div style="background: #dc3545; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Registration Update</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #dc3545; margin-top: 0;">Registration Not Approved</h2>
          <p style="color: #666; line-height: 1.6;">Hi <strong>${Name}</strong>,</p>
          <p style="color: #666; line-height: 1.6;">We regret to inform you that your registration request for IntelliSight has not been approved at this time.</p>
          ${rejectionReason ? `
          <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
            <p style="margin: 0;"><strong>Reason:</strong> ${rejectionReason}</p>
          </div>
          ` : ''}
          <p style="color: #666; line-height: 1.6;">If you believe this is an error or have questions, please contact the administrator.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">IntelliSight - Facial Recognition System</p>
        </div>
      </div>
    `;

    await sendEmail(Email, 'Registration Update - IntelliSight', userEmailHtml);

    return { message: 'User registration rejected' };
  } else {
    throw new Error('Invalid action. Must be "approve" or "reject"');
  }
};

/**
 * Login admin
 */
export const loginAdmin = async ({ email, password }) => {
  // Check if it's the super admin
  if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
    const token = generateToken({
      adminId: 'super_admin',
      email: SUPER_ADMIN_EMAIL,
      role: 'SuperAdmin',
      isSuperAdmin: true
    });

    const superAdmin = {
      Admin_ID: 'super_admin',
      Name: SUPER_ADMIN_NAME,
      Email: SUPER_ADMIN_EMAIL,
      Role: 'SuperAdmin',
      isSuperAdmin: true
    };

    return { admin: superAdmin, token };
  }

  // Find admin by email
  const admin = await prisma.admin.findUnique({
    where: { Email: email },
  });

  if (!admin) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Compare password
  const isPasswordValid = await comparePassword(password, admin.Password);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate token
  const token = generateToken({
    adminId: admin.Admin_ID,
    email: admin.Email,
    role: admin.Role,
    isSuperAdmin: false
  });

  // Return admin without password
  const { Password, ...adminWithoutPassword } = admin;

  return { admin: { ...adminWithoutPassword, isSuperAdmin: false }, token };
};

/**
 * Forgot password - send reset link
 */
export const forgotPassword = async (email) => {
  // Find admin by email
  const admin = await prisma.admin.findUnique({
    where: { Email: email },
  });

  if (!admin) {
    throw new NotFoundError('Email not found');
  }

  // Generate reset token
  const resetToken = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Save reset token in database
  await prisma.passwordResets.create({
    data: {
      Email: email,
      Token: resetToken,
      ExpiresAt: expiresAt,
    },
  });

  // Send reset email
  const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #666; line-height: 1.6;">Hi <strong>${admin.Name}</strong>,</p>
        <p style="color: #666; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password. This link is valid for <strong>15 minutes</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; line-height: 1.6;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">IntelliSight - Facial Recognition System</p>
      </div>
    </div>
  `;

  await sendEmail(email, 'Password Reset Request - IntelliSight', emailHtml);

  return { message: 'Password reset link sent to your email' };
};

/**
 * Reset password
 */
export const resetPassword = async (token, newPassword) => {
  // Validate password length
  if (!newPassword || newPassword.length < 8 || newPassword.length > 16) {
    throw new Error('Password must be between 8 and 16 characters long');
  }

  // Find reset token
  const resetRecord = await prisma.passwordResets.findUnique({
    where: { Token: token },
  });

  if (!resetRecord) {
    throw new NotFoundError('Invalid reset token');
  }

  if (resetRecord.Used) {
    throw new Error('This reset link has already been used');
  }

  if (new Date() > resetRecord.ExpiresAt) {
    throw new Error('This reset link has expired');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update admin password
  await prisma.admin.update({
    where: { Email: resetRecord.Email },
    data: { Password: hashedPassword },
  });

  // Mark reset token as used
  await prisma.passwordResets.update({
    where: { Token: token },
    data: { Used: true },
  });

  return { message: 'Password updated successfully' };
};
/**
 * Get admin statistics (Super Admin only)
 */
export const getAdminStatistics = async () => {
  const totalUsers = await prisma.admin.count();
  const pendingApprovals = await prisma.pendingUsers.count({
    where: { Status: 'PENDING' }
  });
  const approvedUsers = await prisma.admin.count({
    where: { Role: 'User' }
  });
  const adminUsers = await prisma.admin.count({
    where: { Role: 'Admin' }
  });

  return {
    totalUsers,
    pendingApprovals,
    approvedUsers,
    adminUsers
  };
};

/**
 * Get all admins (Super Admin only)
 */
export const getAllAdmins = async () => {
  const admins = await prisma.admin.findMany({
    select: {
      Admin_ID: true,
      Name: true,
      Email: true,
      Role: true,
    },
    orderBy: {
      Admin_ID: 'desc'
    }
  });

  return admins;
};

/**
 * Approve pending user (Super Admin only)
 */
export const approvePendingUser = async (userId) => {
  const pendingUser = await prisma.pendingUsers.findUnique({
    where: { Pending_ID: parseInt(userId) }
  });

  if (!pendingUser) {
    throw new NotFoundError('Pending user not found');
  }

  if (pendingUser.Status !== 'PENDING') {
    throw new Error('User is not in pending state');
  }

  const { Name, Email, Password } = pendingUser;

  // Create admin account
  await prisma.admin.create({
    data: {
      Name,
      Email,
      Password,
      Role: 'User',
    },
  });

  // Update pending user status
  await prisma.pendingUsers.update({
    where: { Pending_ID: parseInt(userId) },
    data: {
      Status: 'APPROVED',
      ProcessedAt: new Date(),
    },
  });

  // Send approval email to user
  const userEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to IntelliSight!</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #28a745; margin-top: 0;">Registration Approved!</h2>
        <p style="color: #666; line-height: 1.6;">Hi <strong>${Name}</strong>,</p>
        <p style="color: #666; line-height: 1.6;">Great news! Your registration request has been approved by the super administrator. You can now access the IntelliSight system.</p>
        <div style="background: #f0f8ff; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Your Account Details:</strong></p>
          <p style="margin: 5px 0;">Email: ${Email}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${FRONTEND_URL}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login Now</a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">IntelliSight - Facial Recognition System</p>
      </div>
    </div>
  `;

  await sendEmail(Email, 'Registration Approved - IntelliSight', userEmailHtml);

  return { message: 'User approved successfully' };
};

/**
 * Reject pending user (Super Admin only)
 */
export const rejectPendingUser = async (userId, reason = 'No reason provided') => {
  const pendingUser = await prisma.pendingUsers.findUnique({
    where: { Pending_ID: parseInt(userId) }
  });

  if (!pendingUser) {
    throw new NotFoundError('Pending user not found');
  }

  if (pendingUser.Status !== 'PENDING') {
    throw new Error('User is not in pending state');
  }

  const { Name, Email } = pendingUser;

  // Update pending user status
  await prisma.pendingUsers.update({
    where: { Pending_ID: parseInt(userId) },
    data: {
      Status: 'REJECTED',
      ProcessedAt: new Date(),
    },
  });

  // Send rejection email to user
  const userEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Registration Update</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #dc3545; margin-top: 0;">Registration Not Approved</h2>
        <p style="color: #666; line-height: 1.6;">Hi <strong>${Name}</strong>,</p>
        <p style="color: #666; line-height: 1.6;">We regret to inform you that your registration request for IntelliSight has not been approved at this time.</p>
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p style="color: #666; line-height: 1.6;">If you believe this is an error or have questions, please contact the administrator.</p>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">IntelliSight - Facial Recognition System</p>
      </div>
    </div>
  `;

  await sendEmail(Email, 'Registration Update - IntelliSight', userEmailHtml);

  return { message: 'User rejected successfully' };
};

/**
 * Delete admin user (Super Admin only)
 */
export const deleteAdminUser = async (adminId) => {
  const admin = await prisma.admin.findUnique({
    where: { Admin_ID: parseInt(adminId) }
  });

  if (!admin) {
    throw new NotFoundError('Admin not found');
  }

  await prisma.admin.delete({
    where: { Admin_ID: parseInt(adminId) }
  });

  return { message: 'Admin deleted successfully' };
};

/**
 * Generate random password
 */
const generateRandomPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Add user directly by super admin
 */
export const addUserByAdmin = async ({ name, email }) => {
  // Check if email already exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { Email: email },
  });

  if (existingAdmin) {
    throw new ConflictError('Email already registered');
  }

  const existingPending = await prisma.pendingUsers.findUnique({
    where: { Email: email },
  });

  if (existingPending && existingPending.Status === 'PENDING') {
    throw new ConflictError('Registration request already pending for this email');
  }

  // Generate random password
  const randomPassword = generateRandomPassword();
  const hashedPassword = await hashPassword(randomPassword);

  // Create admin account
  const newAdmin = await prisma.admin.create({
    data: {
      Name: name,
      Email: email,
      Password: hashedPassword,
      Role: 'User',
    },
  });

  // Generate password reset token
  const resetToken = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

  await prisma.passwordResets.create({
    data: {
      Email: email,
      Token: resetToken,
      ExpiresAt: expiresAt,
    },
  });

  // Send email with reset password link
  const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to IntelliSight!</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea; margin-top: 0;">Account Created Successfully!</h2>
        <p style="color: #666; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
        <p style="color: #666; line-height: 1.6;">Your account has been created by the system administrator. To get started, please set up your password.</p>
        
        <div style="background: #f0f8ff; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Your Account Details:</strong></p>
          <p style="margin: 5px 0;">Email: ${email}</p>
          <p style="margin: 5px 0; color: #999; font-size: 12px;">You'll set your own password in the next step</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Set Your Password</a>
        </div>

        <p style="color: #999; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
        <p style="color: #999; font-size: 14px;">If you didn't expect this email, please contact your administrator.</p>
        
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">IntelliSight - Facial Recognition System</p>
        </div>
      </div>
    </div>
  `;

  await sendEmail(email, 'Welcome to IntelliSight - Set Your Password', emailHtml);

  return { 
    message: 'User created successfully. Password reset email sent.',
    user: {
      Admin_ID: newAdmin.Admin_ID,
      Name: newAdmin.Name,
      Email: newAdmin.Email,
      Role: newAdmin.Role
    }
  };
};

/**
 * Get all pending users (for admin dashboard)
 */
export const getPendingUsers = async () => {
  return await prisma.pendingUsers.findMany({
    where: { Status: 'PENDING' },
    orderBy: { RequestedAt: 'desc' },
    select: {
      Pending_ID: true,
      Name: true,
      Email: true,
      RequestedAt: true,
      Status: true,
    },
  });
};
