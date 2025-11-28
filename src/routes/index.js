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

const router = express.Router();

// Health check (no auth required)
router.use('/health', healthRoutes);

// Mount all routes
router.use('/admin', authRoutes);
router.use('/zones', zoneRoutes);
router.use('/zones/1', zone1Routes); // Zone 1 live tracking
router.use('/cameras', cameraRoutes);
router.use('/teachers', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/timetable', timetableRoutes);
router.use('/face-recognition', faceRecognitionRoutes);
router.use('/live-recognition', liveRecognitionRoutes); // Auto live recognition

export default router;
