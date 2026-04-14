import express from 'express';
import {
  triggerAggregation,
  triggerWeekAggregation,
  getClassAttendance,
  getSlotAttendance,
  getStudentWeeklyView,
  getSectionWeeklyHeatmap,
  getTeacherWeeklyView,
} from '../controllers/classAttendance.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  aggregateAttendanceSchema,
  getClassAttendanceSchema,
  getSlotAttendanceSchema,
  getStudentWeeklySchema,
  getSectionWeeklySchema,
} from '../validators/classAttendance.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Aggregation triggers
router.post('/aggregate', validateRequest(aggregateAttendanceSchema), triggerAggregation);
router.post('/aggregate-week', triggerWeekAggregation);

// Query attendance
router.get('/', validateRequest(getClassAttendanceSchema), getClassAttendance);
router.get('/slot/:slotId', validateRequest(getSlotAttendanceSchema), getSlotAttendance);

// Visualization endpoints
router.get('/student/:studentId/weekly', validateRequest(getStudentWeeklySchema), getStudentWeeklyView);
router.get('/section/:sectionId/weekly', validateRequest(getSectionWeeklySchema), getSectionWeeklyHeatmap);
router.get('/teacher/:teacherId/weekly', getTeacherWeeklyView);

export default router;
