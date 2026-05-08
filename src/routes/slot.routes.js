import express from 'express';
import multer from 'multer';
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
import {
  extractFromImage,
  importExtracted,
} from '../controllers/timetableImport.controller.js';
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

// In-memory upload — buffers go straight to Gemini, never hit disk.
// 8 MB ceiling matches typical phone screenshots; tweak if needed.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.use(authenticateToken);

// AI extraction routes — registered BEFORE generic /:id route to avoid collisions
router.post('/extract-from-image', upload.single('file'), extractFromImage);
router.post('/import-extracted', importExtracted);

router.get('/', getAllSlots);
router.get('/section/:sectionId', validateRequest(getSlotsBySectionSchema), getSlotsBySection);
router.post('/bulk', validateRequest(bulkCreateSlotsSchema), bulkCreateSlots);
router.post('/check-overlaps', validateRequest(validateOverlapsSchema), checkSlotOverlaps);
router.get('/:id', validateRequest(getSlotSchema), getSlotById);
router.post('/', validateRequest(createSlotSchema), createSlot);
router.put('/:id', validateRequest(updateSlotSchema), updateSlot);
router.delete('/:id', validateRequest(deleteSlotSchema), deleteSlot);

export default router;
