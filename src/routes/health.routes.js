/**
 * Health Check Routes
 */

import express from 'express';
import * as healthController from '../controllers/health.controller.js';

const router = express.Router();

// Health check endpoint (no authentication required)
router.get('/', healthController.healthCheck);

export default router;
