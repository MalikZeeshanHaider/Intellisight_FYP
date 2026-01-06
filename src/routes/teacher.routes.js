import express from 'express';
import {
  getAllTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  uploadFacePicture,
} from '../controllers/teacher.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createTeacherSchema,
  updateTeacherSchema,
  getTeacherSchema,
  deleteTeacherSchema,
  uploadFacePictureSchema,
} from '../validators/teacher.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getAllTeachers);
router.get('/:id', validateRequest(getTeacherSchema), getTeacherById);
router.post('/', validateRequest(createTeacherSchema), createTeacher);
router.put('/:id', validateRequest(updateTeacherSchema), updateTeacher);
router.delete('/:id', validateRequest(deleteTeacherSchema), deleteTeacher);
router.post(
  '/:id/face-picture',
  validateRequest(uploadFacePictureSchema),
  uploadFacePicture
);

export default router;
