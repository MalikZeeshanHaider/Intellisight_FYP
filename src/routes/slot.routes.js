import express from 'express';
import {
  getAllSlots,
  getSlotById,
  getSlotsBySection,
  createSlot,
  bulkCreateSlots,
  updateSlot,
  deleteSlot,
  checkSlotOverlaps,
} from '../controllers/slot.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createSlotSchema,
  updateSlotSchema,
  getSlotSchema,
  deleteSlotSchema,
  getSlotsBySectionSchema,
  bulkCreateSlotsSchema,
  validateOverlapsSchema,
} from '../validators/slot.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllSlots);
router.get('/section/:sectionId', validateRequest(getSlotsBySectionSchema), getSlotsBySection);
router.post('/bulk', validateRequest(bulkCreateSlotsSchema), bulkCreateSlots);
router.post('/check-overlaps', validateRequest(validateOverlapsSchema), checkSlotOverlaps);
router.get('/:id', validateRequest(getSlotSchema), getSlotById);
router.post('/', validateRequest(createSlotSchema), createSlot);
router.put('/:id', validateRequest(updateSlotSchema), updateSlot);
router.delete('/:id', validateRequest(deleteSlotSchema), deleteSlot);

export default router;
