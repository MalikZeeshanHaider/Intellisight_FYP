/**
 * Daily Reset Routes
 * API endpoints for daily reset operations
 */

import express from 'express';
import * as dailyResetController from '../controllers/dailyReset.controller.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Get daily statistics
router.get('/statistics', authenticateToken, dailyResetController.getStatistics);

// Manual reset trigger (admin only)
router.post('/manual', authenticateToken, dailyResetController.manualReset);

// Clear active presence only
router.post('/clear-active', authenticateToken, dailyResetController.clearActivePresence);

export default router;
