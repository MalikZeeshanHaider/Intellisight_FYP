/**
 * Live Recognition Routes
 * Automatic face detection and logging endpoints
 */

import express from 'express';
import * as liveRecognitionController from '../controllers/liveRecognition.controller.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Start automatic live recognition
router.post('/start/:zoneId', liveRecognitionController.startLiveRecognition);

// Stop live recognition
router.post('/stop/:zoneId', liveRecognitionController.stopLiveRecognition);

// Get status of active recognition processes
router.get('/status', liveRecognitionController.getRecognitionStatus);

// Get all detection logs (students, teachers, unknown)
router.get('/logs', liveRecognitionController.getDetectionLogs);

// Get currently active presence
router.get('/active', liveRecognitionController.getLiveActivePresence);

export default router;
