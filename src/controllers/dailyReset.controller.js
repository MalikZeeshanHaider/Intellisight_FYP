/**
 * Daily Reset Controller
 * Handles API endpoints for daily reset operations
 */

import asyncHandler from 'express-async-handler';
import { successResponse } from '../utils/response.js';
import { HTTP_STATUS } from '../config/constants.js';
import {
  getDailyStatistics,
  triggerManualReset,
  resetDailyActivePresence,
} from '../services/dailyReset.service.js';

/**
 * @route   GET /api/daily-reset/statistics
 * @desc    Get daily statistics for dashboard
 * @access  Private
 */
export const getStatistics = asyncHandler(async (req, res) => {
  const stats = await getDailyStatistics();
  successResponse(res, stats, 'Daily statistics retrieved successfully');
});

/**
 * @route   POST /api/daily-reset/manual
 * @desc    Manually trigger daily reset (admin only)
 * @access  Private/Admin
 */
export const manualReset = asyncHandler(async (req, res) => {
  const result = await triggerManualReset();
  successResponse(
    res,
    result,
    'Daily reset completed successfully',
    HTTP_STATUS.OK
  );
});

/**
 * @route   POST /api/daily-reset/clear-active
 * @desc    Clear active presence only
 * @access  Private/Admin
 */
export const clearActivePresence = asyncHandler(async (req, res) => {
  const result = await resetDailyActivePresence();
  successResponse(
    res,
    result,
    'Active presence cleared successfully',
    HTTP_STATUS.OK
  );
});

export default {
  getStatistics,
  manualReset,
  clearActivePresence,
};
