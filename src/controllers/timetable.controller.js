import asyncHandler from 'express-async-handler';
import timetableService from '../services/timetable.service.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../config/constants.js';

/**
 * @route   POST /api/timetable/entry
 * @desc    Record entry event
 * @access  Private
 */
export const recordEntry = asyncHandler(async (req, res) => {
  const { personType, personId, zoneId, cameraId, timestamp } = req.body;
  const adminId = req.user.adminId;

  const entry = await timetableService.recordEntry({
    personType,
    personId,
    zoneId,
    cameraId,
    timestamp,
    adminId,
  });

  successResponse(
    res,
    entry,
    SUCCESS_MESSAGES.ENTRY_RECORDED,
    HTTP_STATUS.CREATED
  );
});

/**
 * @route   POST /api/timetable/exit
 * @desc    Record exit event
 * @access  Private
 */
export const recordExit = asyncHandler(async (req, res) => {
  const { personType, personId, zoneId, timestamp } = req.body;
  const adminId = req.user.adminId;

  const exit = await timetableService.recordExit({
    personType,
    personId,
    zoneId,
    timestamp,
    adminId,
  });

  successResponse(res, exit, SUCCESS_MESSAGES.EXIT_RECORDED);
});

/**
 * @route   GET /api/timetable
 * @desc    Query timetable with filters
 * @access  Private
 */
export const queryTimetable = asyncHandler(async (req, res) => {
  const filters = req.query;

  const result = await timetableService.queryTimetable(filters);

  paginatedResponse(
    res,
    result.entries,
    result.pagination,
    'Timetable entries retrieved successfully'
  );
});

/**
 * @route   GET /api/timetable/active
 * @desc    Get currently active persons (no exit)
 * @access  Private
 */
export const getActivePersons = asyncHandler(async (req, res) => {
  const activePersons = await timetableService.getActivePersons();

  successResponse(
    res,
    {
      count: activePersons.length,
      activePersons,
    },
    'Active persons retrieved successfully'
  );
});

/**
 * @route   GET /api/timetable/analytics
 * @desc    Get analytics dashboard data
 * @access  Private
 */
export const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await timetableService.getAnalytics();

  successResponse(res, analytics, 'Analytics data retrieved successfully');
});

/**
 * @route   GET /api/timetable/recent
 * @desc    Get recent activity (last N entries/exits)
 * @access  Private
 */
export const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const recentActivity = await timetableService.getRecentActivity(limit);

  successResponse(res, recentActivity, 'Recent activity retrieved successfully');
});
