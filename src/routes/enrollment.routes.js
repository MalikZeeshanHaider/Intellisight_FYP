import express from 'express';
import {
  getEnrollmentsBySection,
  createEnrollment,
  bulkEnroll,
  deleteEnrollment,
  getStudentEnrollments,
} from '../controllers/enrollment.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  createEnrollmentSchema,
  bulkEnrollSchema,
  deleteEnrollmentSchema,
  getEnrollmentsBySectionSchema,
} from '../validators/enrollment.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/section/:sectionId', validateRequest(getEnrollmentsBySectionSchema), getEnrollmentsBySection);
router.get('/student/:studentId', getStudentEnrollments);
router.post('/', validateRequest(createEnrollmentSchema), createEnrollment);
router.post('/bulk', validateRequest(bulkEnrollSchema), bulkEnroll);
router.delete('/:id', validateRequest(deleteEnrollmentSchema), deleteEnrollment);

export default router;
