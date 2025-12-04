import express from 'express';
import {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  getCurrentPersonsInZone,
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

router.get('/', getAllZones);
router.get('/:id', validateRequest(getZoneSchema), getZoneById);
router.get('/:id/current', validateRequest(getZoneSchema), getCurrentPersonsInZone);
router.post('/', validateRequest(createZoneSchema), createZone);
router.put('/:id', validateRequest(updateZoneSchema), updateZone);
router.delete('/:id', validateRequest(deleteZoneSchema), deleteZone);

export default router;
