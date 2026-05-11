import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, UnauthorizedError } from '../utils/errors.js';

/**
 * POST /api/access-requests
 * Non-SuperAdmin submits one or more permission requests.
 * Body: { permissionKeys: string[], message?: string }
 */
export const createRequest = asyncHandler(async (req, res) => {
  const { permissionKeys = [], message } = req.body;
  if (!permissionKeys.length) throw new Error('At least one permission key is required');

  const adminId = req.user.adminId;

  // Verify each key exists in the Permission table
  const perms = await prisma.permission.findMany({ where: { Key: { in: permissionKeys } } });
  if (!perms.length) throw new NotFoundError('None of the requested permission keys are valid');

  // Skip keys that already have a pending request from this admin
  const existing = await prisma.accessRequest.findMany({
    where: { Admin_ID: adminId, Permission_Key: { in: permissionKeys }, Status: 'pending' },
    select: { Permission_Key: true },
  });
  const existingKeys = new Set(existing.map((r) => r.Permission_Key));
  const newKeys = permissionKeys.filter((k) => !existingKeys.has(k));

  if (!newKeys.length) {
    return successResponse(res, [], 'You already have a pending request for all selected permissions');
  }

  const created = await prisma.accessRequest.createMany({
    data: newKeys.map((key) => ({
      Admin_ID:       adminId,
      Permission_Key: key,
      Message:        message?.trim() || null,
      Status:         'pending',
    })),
  });

  successResponse(res, { count: created.count }, 'Access request submitted', 201);
});

/**
 * GET /api/access-requests/my
 * Returns all access requests submitted by the current admin.
 */
export const getMyRequests = asyncHandler(async (req, res) => {
  const requests = await prisma.accessRequest.findMany({
    where:   { Admin_ID: req.user.adminId },
    orderBy: { RequestedAt: 'desc' },
  });
  successResponse(res, requests, 'Your access requests retrieved');
});

/**
 * GET /api/access-requests
 * SuperAdmin: returns all access requests with admin info.
 */
export const getAllRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { Status: status } : {};

  const requests = await prisma.accessRequest.findMany({
    where,
    include: {
      admin: { select: { Admin_ID: true, Name: true, Email: true, Role: true } },
    },
    orderBy: { RequestedAt: 'desc' },
  });

  // Attach the human-readable permission name
  const permKeys = [...new Set(requests.map((r) => r.Permission_Key))];
  const perms = await prisma.permission.findMany({
    where: { Key: { in: permKeys } },
    select: { Key: true, Name: true, Category: true },
  });
  const permMap = Object.fromEntries(perms.map((p) => [p.Key, p]));

  const enriched = requests.map((r) => ({
    ...r,
    permissionName:     permMap[r.Permission_Key]?.Name ?? r.Permission_Key,
    permissionCategory: permMap[r.Permission_Key]?.Category ?? 'Unknown',
  }));

  successResponse(res, enriched, 'All access requests retrieved');
});

/**
 * GET /api/access-requests/pending-count
 * SuperAdmin: returns count of pending requests (for badge).
 */
export const getPendingCount = asyncHandler(async (req, res) => {
  const count = await prisma.accessRequest.count({ where: { Status: 'pending' } });
  successResponse(res, { count }, 'Pending count retrieved');
});

/**
 * PUT /api/access-requests/:id/review
 * SuperAdmin approves or rejects a request.
 * Body: { action: 'approve' | 'reject', reviewNote?: string }
 */
export const reviewRequest = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { action, reviewNote } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new Error('action must be "approve" or "reject"');
  }

  const request = await prisma.accessRequest.findUnique({ where: { Request_ID: id } });
  if (!request) throw new NotFoundError('Access request not found');
  if (request.Status !== 'pending') throw new Error('This request has already been reviewed');

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const reviewerId = Number.isInteger(req.user.adminId) ? req.user.adminId : null;

  await prisma.accessRequest.update({
    where: { Request_ID: id },
    data: {
      Status:     newStatus,
      ReviewNote: reviewNote?.trim() || null,
      ReviewedAt: new Date(),
      ReviewedBy: reviewerId,
    },
  });

  // If approved, add the permission to the admin's current role
  // (or create a new personal role if the admin has no role yet)
  if (action === 'approve') {
    await prisma.$transaction(async (tx) => {
      const admin = await tx.admin.findUnique({ where: { Admin_ID: request.Admin_ID } });
      const perm  = await tx.permission.findUnique({ where: { Key: request.Permission_Key } });

      if (!perm) return; // permission key no longer exists — skip silently

      let roleId = admin.Role_ID;

      if (!roleId) {
        // Admin has no role yet — create a personal role and assign it
        const newRole = await tx.role.create({
          data: {
            Name:        `Admin #${admin.Admin_ID} Custom Role`,
            Description: 'Auto-created from access request approval',
          },
        });
        await tx.admin.update({
          where: { Admin_ID: admin.Admin_ID },
          data:  { Role_ID: newRole.Role_ID },
        });
        roleId = newRole.Role_ID;
      }

      // Add permission to role only if not already present
      const existing = await tx.rolePermission.findFirst({
        where: { Role_ID: roleId, Permission_ID: perm.Permission_ID },
      });
      if (!existing) {
        await tx.rolePermission.create({
          data: { Role_ID: roleId, Permission_ID: perm.Permission_ID },
        });
      }
    });
  }

  successResponse(res, { Request_ID: id, Status: newStatus }, `Request ${newStatus}`);
});
