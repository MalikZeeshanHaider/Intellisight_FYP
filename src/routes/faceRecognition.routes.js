import express from 'express';
const router = express.Router();
import faceRecognitionController from '../controllers/faceRecognition.controller.js';
import { authenticateToken } from '../middlewares/auth.js';

// Enroll single person
router.post('/enroll', authenticateToken, faceRecognitionController.enrollPerson);

// Enroll all persons
router.post('/enroll-all', authenticateToken, faceRecognitionController.enrollAll);

// Get active presence
router.get('/active-presence', authenticateToken, faceRecognitionController.getAllActivePresence);
router.get('/active-presence/:zoneId', authenticateToken, faceRecognitionController.getActivePresence);

// Get attendance logs
router.get('/attendance-log', authenticateToken, faceRecognitionController.getAttendanceLogs);

// Start recognition for zone
router.post('/start/:zoneId', authenticateToken, faceRecognitionController.startRecognition);

export default router;
