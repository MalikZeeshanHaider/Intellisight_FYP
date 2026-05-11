import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

// ── Predefined system permissions (seeded on first call) ─────────────────────
const SYSTEM_PERMISSIONS = [
  { Name: 'View Dashboard',        Key: 'view_dashboard',       Category: 'General',              Description: 'Access the main dashboard' },
  { Name: 'View Active Presence',  Key: 'view_active_presence', Category: 'Monitoring',            Description: 'See who is currently in a zone' },
  { Name: 'View Unknown Faces',    Key: 'view_unknown_faces',   Category: 'Monitoring',            Description: 'Review unidentified face captures' },
  { Name: 'View Attendance',       Key: 'view_attendance',      Category: 'Monitoring',            Description: 'Access attendance analytics' },
  { Name: 'Manage Students',       Key: 'manage_students',      Category: 'People Management',     Description: 'Add, edit, and delete student records' },
  { Name: 'Manage Faculty',        Key: 'manage_teachers',      Category: 'People Management',     Description: 'Add, edit, and delete teacher records' },
  { Name: 'Manage Zones',          Key: 'manage_zones',         Category: 'Infrastructure',        Description: 'Create and configure zones' },
  { Name: 'Manage Cameras',        Key: 'manage_cameras',       Category: 'Infrastructure',        Description: 'Add and configure cameras' },
  { Name: 'View Logs',             Key: 'view_logs',            Category: 'System',                Description: 'Access system activity logs' },
];

/** Ensure system permissions exist in the DB (idempotent). */
const seedPermissions = async () => {
  for (const p of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { Key: p.Key },
      update: {},
      create: p,
    });
  }
};

// ── Permissions ───────────────────────────────────────────────────────────────

/**
 * GET /api/roles/permissions
 * List all available permissions.
 */
export const listPermissions = asyncHandler(async (req, res) => {
  await seedPermissions();
  const permissions = await prisma.permission.findMany({ orderBy: [{ Category: 'asc' }, { Name: 'asc' }] });
  successResponse(res, permissions, 'Permissions retrieved');
});

// ── Roles CRUD ────────────────────────────────────────────────────────────────

/**
 * GET /api/roles
 * List all roles with their permission keys and assigned admin count.
 */
export const listRoles = asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({
    include: {
      RolePermissions: { include: { permission: true } },
      _count: { select: { Admins: true } },
    },
    orderBy: { CreatedAt: 'asc' },
  });

  const formatted = roles.map((r) => ({
    Role_ID:     r.Role_ID,
    Name:        r.Name,
    Description: r.Description,
    IsSystem:    r.IsSystem,
    adminCount:  r._count.Admins,
    permissions: r.RolePermissions.map((rp) => rp.permission.Key),
    createdAt:   r.CreatedAt,
  }));

  successResponse(res, formatted, 'Roles retrieved');
});

/**
 * POST /api/roles
 * Create a new role (optionally with initial permission keys).
 */
export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissionKeys = [] } = req.body;
  if (!name?.trim()) throw new Error('Role name is required');

  const existing = await prisma.role.findUnique({ where: { Name: name.trim() } });
  if (existing) throw new ConflictError(`Role "${name}" already exists`);

  await seedPermissions();

  const role = await prisma.role.create({
    data: {
      Name:        name.trim(),
      Description: description?.trim() || null,
    },
  });

  if (permissionKeys.length > 0) {
    const perms = await prisma.permission.findMany({ where: { Key: { in: permissionKeys } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ Role_ID: role.Role_ID, Permission_ID: p.Permission_ID })),
      skipDuplicates: true,
    });
  }

  const full = await prisma.role.findUnique({
    where: { Role_ID: role.Role_ID },
    include: { RolePermissions: { include: { permission: true } } },
  });

  successResponse(res, {
    ...full,
    permissions: full.RolePermissions.map((rp) => rp.permission.Key),
  }, 'Role created', 201);
});

/**
 * PUT /api/roles/:id
 * Update role name / description.
 */
export const updateRole = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;

  const role = await prisma.role.findUnique({ where: { Role_ID: id } });
  if (!role) throw new NotFoundError('Role not found');

  if (name?.trim() && name.trim() !== role.Name) {
    const clash = await prisma.role.findUnique({ where: { Name: name.trim() } });
    if (clash) throw new ConflictError(`Role "${name}" already exists`);
  }

  const updated = await prisma.role.update({
    where: { Role_ID: id },
    data: {
      Name:        name?.trim() ?? role.Name,
      Description: description !== undefined ? description?.trim() || null : role.Description,
    },
  });

  successResponse(res, updated, 'Role updated');
});

/**
 * DELETE /api/roles/:id
 * Delete a non-system role (unassigns all admins first).
 */
export const deleteRole = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const role = await prisma.role.findUnique({ where: { Role_ID: id } });
  if (!role) throw new NotFoundError('Role not found');
  if (role.IsSystem) throw new Error('Cannot delete a system role');

  // Unassign all admins from this role first
  await prisma.admin.updateMany({ where: { Role_ID: id }, data: { Role_ID: null } });
  await prisma.role.delete({ where: { Role_ID: id } });

  successResponse(res, { Role_ID: id }, 'Role deleted');
});

// ── Permission assignment ─────────────────────────────────────────────────────

/**
 * PUT /api/roles/:id/permissions
 * Replace the full permission set of a role with the provided keys.
 */
export const setRolePermissions = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { permissionKeys = [] } = req.body;

  const role = await prisma.role.findUnique({ where: { Role_ID: id } });
  if (!role) throw new NotFoundError('Role not found');

  await seedPermissions();

  // Delete old entries
  await prisma.rolePermission.deleteMany({ where: { Role_ID: id } });

  if (permissionKeys.length > 0) {
    const perms = await prisma.permission.findMany({ where: { Key: { in: permissionKeys } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ Role_ID: id, Permission_ID: p.Permission_ID })),
      skipDuplicates: true,
    });
  }

  const updated = await prisma.role.findUnique({
    where: { Role_ID: id },
    include: { RolePermissions: { include: { permission: true } } },
  });

  successResponse(res, {
    Role_ID:     updated.Role_ID,
    Name:        updated.Name,
    permissions: updated.RolePermissions.map((rp) => rp.permission.Key),
  }, 'Permissions updated');
});

// ── Assign role to admin ──────────────────────────────────────────────────────

/**
 * PUT /api/roles/assign
 * Body: { adminId, roleId }  — set roleId to null to remove the role.
 */
export const assignRoleToAdmin = asyncHandler(async (req, res) => {
  const { adminId, roleId } = req.body;
  if (!adminId) throw new Error('adminId is required');

  const admin = await prisma.admin.findUnique({ where: { Admin_ID: parseInt(adminId) } });
  if (!admin) throw new NotFoundError('Admin not found');

  if (roleId !== null && roleId !== undefined) {
    const role = await prisma.role.findUnique({ where: { Role_ID: parseInt(roleId) } });
    if (!role) throw new NotFoundError('Role not found');
  }

  const updated = await prisma.admin.update({
    where: { Admin_ID: parseInt(adminId) },
    data:  { Role_ID: roleId ? parseInt(roleId) : null },
    select: { Admin_ID: true, Name: true, Email: true, Role: true, Role_ID: true },
  });

  successResponse(res, updated, roleId ? 'Role assigned' : 'Role removed');
});

/**
 * GET /api/roles/:id/admins
 * List admins assigned to a role.
 */
export const getRoleAdmins = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const role = await prisma.role.findUnique({ where: { Role_ID: id } });
  if (!role) throw new NotFoundError('Role not found');

  const admins = await prisma.admin.findMany({
    where:  { Role_ID: id },
    select: { Admin_ID: true, Name: true, Email: true, Role: true },
  });

  successResponse(res, admins, 'Admins retrieved');
});
