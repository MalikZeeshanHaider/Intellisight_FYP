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
          TimeTable: true,
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
      Students: {
        select: {
          Student_ID: true,
          Name: true,
          Email: true,
        },
      },
      Teacher: {
        select: {
          Teacher_ID: true,
          Name: true,
          Email: true,
        },
      },
      _count: {
        select: {
          TimeTable: true,
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
