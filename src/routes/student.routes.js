import express from 'express';
import {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadFacePicture,
} from '../controllers/student.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createStudentSchema,
  updateStudentSchema,
  getStudentSchema,
  deleteStudentSchema,
  uploadFacePictureSchema,
} from '../validators/student.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getAllStudents);
router.get('/:id', validateRequest(getStudentSchema), getStudentById);
router.post('/', validateRequest(createStudentSchema), createStudent);
router.put('/:id', validateRequest(updateStudentSchema), updateStudent);
router.delete('/:id', validateRequest(deleteStudentSchema), deleteStudent);
router.post(
  '/:id/face-picture',
  validateRequest(uploadFacePictureSchema),
  uploadFacePicture
);

export default router;
