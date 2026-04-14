import express from 'express';
import authRoutes from './auth.routes.js';
import zoneRoutes from './zone.routes.js';
import zone1Routes from './zone1.routes.js';
import cameraRoutes from './camera.routes.js';
import teacherRoutes from './teacher.routes.js';
import studentRoutes from './student.routes.js';
import timetableRoutes from './timetable.routes.js';
import healthRoutes from './health.routes.js';
import faceRecognitionRoutes from './faceRecognition.routes.js';
import liveRecognitionRoutes from './liveRecognition.routes.js';
import dailyResetRoutes from './dailyReset.routes.js';
// ── Timetable / Academic ──────────────────────────────────────
import sectionRoutes from './section.routes.js';
import courseRoutes from './course.routes.js';
import enrollmentRoutes from './enrollment.routes.js';
import slotRoutes from './slot.routes.js';
import classAttendanceRoutes from './classAttendance.routes.js';

const router = express.Router();

// Health check (no auth required)
router.use('/health', healthRoutes);

// Mount all routes
router.use('/auth', authRoutes); // Changed from /admin to /auth
router.use('/zones/1', zone1Routes); // Zone 1 live tracking - must be before generic /zones
router.use('/zones', zoneRoutes);
router.use('/cameras', cameraRoutes);
router.use('/teachers', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/timetable', timetableRoutes);
router.use('/face-recognition', faceRecognitionRoutes);
router.use('/live-recognition', liveRecognitionRoutes); // Auto live recognition
router.use('/daily-reset', dailyResetRoutes); // Daily reset operations
// ── Academic / Timetable Management ──────────────────────────
router.use('/sections', sectionRoutes);
router.use('/courses', courseRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/slots', slotRoutes);
router.use('/class-attendance', classAttendanceRoutes);

export default router;
