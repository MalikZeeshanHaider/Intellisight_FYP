import express from 'express';
import {
  recordEntry,
  recordExit,
  queryTimetable,
  getActivePersons,
  getAnalytics,
  getRecentActivity,
  getDailyDetectionStats,
} from '../controllers/timetable.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  entrySchema,
  exitSchema,
  queryTimetableSchema,
} from '../validators/timetable.validator.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/entry', validateRequest(entrySchema), recordEntry);
router.post('/exit', validateRequest(exitSchema), recordExit);
router.get('/', validateRequest(queryTimetableSchema), queryTimetable);
router.get('/active', getActivePersons);
router.get('/analytics', getAnalytics);
router.get('/recent', getRecentActivity);
router.get('/daily-stats', getDailyDetectionStats);

export default router;
