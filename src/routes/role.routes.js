import express from 'express';
import { authenticateToken, requireSuperAdmin } from '../middlewares/auth.js';
import {
  listPermissions,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  assignRoleToAdmin,
  getRoleAdmins,
} from '../controllers/role.controller.js';

const router = express.Router();

// GET /roles/permissions — any authenticated admin may read available permissions
// (so non-SuperAdmin users can see what to request access to)
router.get('/permissions', authenticateToken, listPermissions);

// All other role routes require SuperAdmin
router.use(authenticateToken, requireSuperAdmin);
router.get('/',                   listRoles);
router.post('/',                  createRole);
router.put('/assign',             assignRoleToAdmin);
router.put('/:id',                updateRole);
router.delete('/:id',             deleteRole);
router.put('/:id/permissions',    setRolePermissions);
router.get('/:id/admins',         getRoleAdmins);

export default router;
