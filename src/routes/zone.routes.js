import express from 'express';
import {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  getCurrentPersonsInZone,
  getZoneUnknownCount,
  getAllUnknownFaces,
  getAllUnknownStats,
  getRecentAlerts,
  bulkDeleteUnknownFaces,
} from '../controllers/zone.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createZoneSchema,
  updateZoneSchema,
  getZoneSchema,
  deleteZoneSchema,
} from '../validators/zone.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Static paths must be declared BEFORE the generic /:id route so Express doesn't
// treat "unknown-faces" or "unknown-stats" as a Zone_id.
router.get('/unknown-faces', getAllUnknownFaces);
router.post('/unknown-faces/bulk-delete', bulkDeleteUnknownFaces);
router.get('/unknown-stats', getAllUnknownStats);
router.get('/recent-alerts', getRecentAlerts);

router.get('/', getAllZones);
router.get('/:id', validateRequest(getZoneSchema), getZoneById);
router.get('/:id/current', validateRequest(getZoneSchema), getCurrentPersonsInZone);
router.get('/:id/unknown-count', validateRequest(getZoneSchema), getZoneUnknownCount);
router.post('/', validateRequest(createZoneSchema), createZone);
router.put('/:id', validateRequest(updateZoneSchema), updateZone);
router.delete('/:id', validateRequest(deleteZoneSchema), deleteZone);

export default router;
