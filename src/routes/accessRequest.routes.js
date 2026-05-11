import express from 'express';
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  getPendingCount,
  reviewRequest,
} from '../controllers/accessRequest.controller.js';
import { authenticateToken, requireSuperAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Non-SuperAdmin routes
router.post('/',    authenticateToken, createRequest);
router.get('/my',   authenticateToken, getMyRequests);

// SuperAdmin-only routes
router.get('/pending-count', authenticateToken, requireSuperAdmin, getPendingCount);
router.get('/',              authenticateToken, requireSuperAdmin, getAllRequests);
router.put('/:id/review',   authenticateToken, requireSuperAdmin, reviewRequest);

export default router;
