import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * @route   GET /api/sections
 * @desc    Get all sections
 */
export const getAllSections = asyncHandler(async (req, res) => {
  const sections = await prisma.section.findMany({
    orderBy: { Section_ID: 'asc' },
    include: {
      _count: {
        select: {
          Enrollments: true,
          TimetableSlots: true,
        },
      },
    },
  });

  successResponse(res, sections, 'Sections retrieved successfully');
});

/**
 * @route   GET /api/sections/:id
 * @desc    Get section by ID with enrollments and slots
 */
export const getSectionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const section = await prisma.section.findUnique({
    where: { Section_ID: parseInt(id) },
    include: {
      Enrollments: {
        include: {
          student: {
            select: { Student_ID: true, Name: true, RollNumber: true, Email: true },
          },
        },
      },
      TimetableSlots: {
        where: { IsActive: true },
        include: {
          teacher: { select: { Teacher_ID: true, Name: true } },
          zone: { select: { Zone_id: true, Zone_Name: true } },
          course: { select: { Course_ID: true, Name: true, Code: true } },
        },
        orderBy: [{ DayOfWeek: 'asc' }, { StartTime: 'asc' }],
      },
      _count: {
        select: { Enrollments: true, TimetableSlots: true },
      },
    },
  });

  if (!section) {
    throw new NotFoundError(`Section with ID ${id} not found`);
  }

  successResponse(res, section, 'Section retrieved successfully');
});

/**
 * @route   POST /api/sections
 * @desc    Create new section
 */
export const createSection = asyncHandler(async (req, res) => {
  const { Name, Department, Semester, Shift } = req.body;

  // Check if name already exists
  const existing = await prisma.section.findUnique({
    where: { Name },
  });

  if (existing) {
    throw new BadRequestError(`Section "${Name}" already exists`);
  }

  const section = await prisma.section.create({
    data: { Name, Department, Semester, Shift },
  });

  successResponse(res, section, 'Section created successfully', HTTP_STATUS.CREATED);
});

/**
 * @route   PUT /api/sections/:id
 * @desc    Update section
 */
export const updateSection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const existing = await prisma.section.findUnique({
    where: { Section_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Section with ID ${id} not found`);
  }

  // Check name uniqueness if name is being changed
  if (data.Name && data.Name !== existing.Name) {
    const nameExists = await prisma.section.findUnique({
      where: { Name: data.Name },
    });
    if (nameExists) {
      throw new BadRequestError(`Section "${data.Name}" already exists`);
    }
  }

  const section = await prisma.section.update({
    where: { Section_ID: parseInt(id) },
    data,
  });

  successResponse(res, section, 'Section updated successfully');
});

/**
 * @route   DELETE /api/sections/:id
 * @desc    Delete section (cascades to enrollments and slots)
 */
export const deleteSection = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.section.findUnique({
    where: { Section_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Section with ID ${id} not found`);
  }

  await prisma.section.delete({
    where: { Section_ID: parseInt(id) },
  });

  successResponse(res, null, 'Section deleted successfully');
});
