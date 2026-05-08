import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../config/constants.js';

/**
 * @route   GET /api/zones
 * @desc    Get all zones
 * @access  Private
 */
export const getAllZones = asyncHandler(async (req, res) => {
  const zones = await prisma.zone.findMany({
    include: {
      _count: {
        select: {
          Camara: true,
          AttendanceLog: true,
          ActivePresence: true,
        },
      },
    },
    orderBy: { Zone_id: 'asc' },
  });

  successResponse(res, zones, 'Zones retrieved successfully');
});

/**
 * @route   GET /api/zones/:id
 * @desc    Get zone by ID
 * @access  Private
 */
export const getZoneById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const zone = await prisma.zone.findUnique({
    where: { Zone_id: id },
    include: {
      Camara: true,
      _count: {
        select: {
          AttendanceLog: true,
          ActivePresence: true,
        },
      },
    },
  });

  if (!zone) {
    throw new NotFoundError(`Zone with ID ${id} not found`);
  }

  successResponse(res, zone, 'Zone retrieved successfully');
});

/**
 * @route   POST /api/zones
 * @desc    Create new zone
 * @access  Private
 */
export const createZone = asyncHandler(async (req, res) => {
  const { Zone_Name } = req.body;

  const zone = await prisma.zone.create({
    data: { Zone_Name },
  });

  successResponse(
    res,
    zone,
    SUCCESS_MESSAGES.CREATED,
    HTTP_STATUS.CREATED
  );
});

/**
 * @route   PUT /api/zones/:id
 * @desc    Update zone
 * @access  Private
 */
export const updateZone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { Zone_Name } = req.body;

  // Check if zone exists
  const existingZone = await prisma.zone.findUnique({
    where: { Zone_id: id },
  });

  if (!existingZone) {
    throw new NotFoundError(`Zone with ID ${id} not found`);
  }

  const zone = await prisma.zone.update({
    where: { Zone_id: id },
    data: { Zone_Name },
  });

  successResponse(res, zone, SUCCESS_MESSAGES.UPDATED);
});

/**
 * @route   DELETE /api/zones/:id
 * @desc    Delete zone
 * @access  Private
 */
export const deleteZone = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if zone exists
  const existingZone = await prisma.zone.findUnique({
    where: { Zone_id: id },
  });

  if (!existingZone) {
    throw new NotFoundError(`Zone with ID ${id} not found`);
  }

  await prisma.zone.delete({
    where: { Zone_id: id },
  });

  successResponse(
    res,
    { Zone_id: id },
    SUCCESS_MESSAGES.DELETED,
    HTTP_STATUS.OK
  );
});

/**
 * @route   GET /api/zones/:id/unknown-count
 * @desc    Count unknown faces detected in a specific zone
 * @access  Private
 */
export const getZoneUnknownCount = asyncHandler(async (req, res) => {
  const zoneId = parseInt(req.params.id);

  const count = await prisma.unknownFaces.count({
    where: { Zone_id: zoneId },
  });

  successResponse(res, { count, zone_id: zoneId }, 'Unknown face count retrieved');
});

/**
 * @route   GET /api/zones/unknown-faces
 * @desc    List unknown faces from ALL zones (replaces zone-1-only endpoint).
 *          Returns face image as base64 data URL so the frontend can render
 *          directly without a separate fetch per row.
 * @access  Private
 */
export const getAllUnknownFaces = asyncHandler(async (req, res) => {
  const { limit = 100, status, zone_id } = req.query;

  const where = {};
  if (status) where.Status = status;
  if (zone_id) where.Zone_id = parseInt(zone_id);

  const rows = await prisma.unknownFaces.findMany({
    where,
    orderBy: { DetectedTime: 'desc' },
    take: parseInt(limit),
  });

  // UnknownFaces has no Prisma relation to Zone — fetch zone names in one
  // batch query and join in JS so the page can display "C Block" etc.
  const zoneIds = [...new Set(rows.map((r) => r.Zone_id).filter((id) => id != null))];
  const zones = zoneIds.length
    ? await prisma.zone.findMany({
        where: { Zone_id: { in: zoneIds } },
        select: { Zone_id: true, Zone_Name: true },
      })
    : [];
  const zoneNameById = Object.fromEntries(zones.map((z) => [z.Zone_id, z.Zone_Name]));

  const data = rows.map((row) => ({
    Unknown_ID:    row.Unknown_ID,
    Zone_id:       row.Zone_id,
    Zone_Name:     zoneNameById[row.Zone_id] || `Zone ${row.Zone_id ?? '?'}`,
    Confidence:    row.Confidence,
    Status:        row.Status,
    Notes:         row.Notes,
    DetectedTime:  row.DetectedTime,
    // Key name matches the existing UI (UnknownFaces.jsx renders face.CapturedImage)
    CapturedImage: row.Captured_Image
      ? `data:image/jpeg;base64,${Buffer.from(row.Captured_Image).toString('base64')}`
      : null,
  }));

  successResponse(res, data, 'Unknown faces retrieved');
});

/**
 * @route   GET /api/zones/unknown-stats
 * @desc    Aggregate counts across ALL zones for the Unknown Faces page header.
 * @access  Private
 */
export const getAllUnknownStats = asyncHandler(async (req, res) => {
  const [total, pending, identified, ignored] = await Promise.all([
    prisma.unknownFaces.count(),
    prisma.unknownFaces.count({ where: { Status: 'PENDING'    } }),
    prisma.unknownFaces.count({ where: { Status: 'IDENTIFIED' } }),
    prisma.unknownFaces.count({ where: { Status: 'IGNORED'    } }),
  ]);

  successResponse(res, { total, pending, identified, ignored }, 'Unknown face stats retrieved');
});

/**
 * @route   GET /api/zones/recent-alerts
 * @desc    Returns unknown face detections from the last 30 minutes (no image payload)
 *          Used by the alert bell in the dashboard header.
 * @access  Private
 */
export const getRecentAlerts = asyncHandler(async (req, res) => {
  const minutes = parseInt(req.query.minutes) || 30;
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const rows = await prisma.unknownFaces.findMany({
    where: { DetectedTime: { gte: since } },
    orderBy: { DetectedTime: 'desc' },
    take: 50,
    select: { Unknown_ID: true, Zone_id: true, Confidence: true, Status: true, DetectedTime: true },
  });

  const zoneIds = [...new Set(rows.map((r) => r.Zone_id).filter(Boolean))];
  const zones = zoneIds.length
    ? await prisma.zone.findMany({ where: { Zone_id: { in: zoneIds } }, select: { Zone_id: true, Zone_Name: true } })
    : [];
  const zoneNameById = Object.fromEntries(zones.map((z) => [z.Zone_id, z.Zone_Name]));

  const alerts = rows.map((r) => ({
    id: `unknown_${r.Unknown_ID}`,
    type: 'UNKNOWN_FACE',
    severity: 'warning',
    message: `Unknown face detected in ${zoneNameById[r.Zone_id] || `Zone ${r.Zone_id ?? '?'}`}`,
    zoneName: zoneNameById[r.Zone_id] || `Zone ${r.Zone_id ?? '?'}`,
    timestamp: r.DetectedTime,
    status: r.Status,
  }));

  successResponse(res, { alerts, total: alerts.length }, 'Recent alerts retrieved');
});

/**
 * @route   GET /api/zones/:id/current
 * @desc    Get all persons currently in a specific zone
 * @access  Private
 */
export const getCurrentPersonsInZone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const zoneId = parseInt(id);

  // Check if zone exists
  const zone = await prisma.zone.findUnique({
    where: { Zone_id: zoneId },
  });

  if (!zone) {
    throw new NotFoundError(`Zone with ID ${zoneId} not found`);
  }

  const currentPersons = await prisma.activePresence.findMany({
    where: {
      Zone_id: zoneId
    },
    include: {
      teacher: {
        select: {
          Teacher_ID: true,
          Name: true,
          Email: true,
          Department: true,
          Gender: true,
          Face_Picture_1: true
        }
      },
      student: {
        select: {
          Student_ID: true,
          Name: true,
          Email: true,
          Department: true,
          Gender: true,
          RollNumber: true,
          Face_Picture_1: true
        }
      },
      zone: {
        select: {
          Zone_id: true,
          Zone_Name: true
        }
      }
    },
    orderBy: {
      EntryTime: 'desc'
    }
  });

  successResponse(res, currentPersons, `Active persons in ${zone.Zone_Name} retrieved successfully`);
});
