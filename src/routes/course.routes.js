import express from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/course.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createCourseSchema,
  updateCourseSchema,
  getCourseSchema,
  deleteCourseSchema,
} from '../validators/course.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllCourses);
router.get('/:id', validateRequest(getCourseSchema), getCourseById);
router.post('/', validateRequest(createCourseSchema), createCourse);
router.put('/:id', validateRequest(updateCourseSchema), updateCourse);
router.delete('/:id', validateRequest(deleteCourseSchema), deleteCourse);

export default router;
