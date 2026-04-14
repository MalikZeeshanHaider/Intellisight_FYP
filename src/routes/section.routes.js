import express from 'express';
import {
  getAllSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
} from '../controllers/section.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createSectionSchema,
  updateSectionSchema,
  getSectionSchema,
  deleteSectionSchema,
} from '../validators/section.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllSections);
router.get('/:id', validateRequest(getSectionSchema), getSectionById);
router.post('/', validateRequest(createSectionSchema), createSection);
router.put('/:id', validateRequest(updateSectionSchema), updateSection);
router.delete('/:id', validateRequest(deleteSectionSchema), deleteSection);

export default router;
