import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * @route   GET /api/courses
 * @desc    Get all courses
 */
export const getAllCourses = asyncHandler(async (req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { Course_ID: 'asc' },
    include: {
      _count: {
        select: { TimetableSlots: true },
      },
    },
  });

  successResponse(res, courses, 'Courses retrieved successfully');
});

/**
 * @route   GET /api/courses/:id
 * @desc    Get course by ID
 */
export const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await prisma.course.findUnique({
    where: { Course_ID: parseInt(id) },
    include: {
      TimetableSlots: {
        where: { IsActive: true },
        include: {
          section: { select: { Section_ID: true, Name: true } },
          teacher: { select: { Teacher_ID: true, Name: true } },
          zone: { select: { Zone_id: true, Zone_Name: true } },
        },
      },
    },
  });

  if (!course) {
    throw new NotFoundError(`Course with ID ${id} not found`);
  }

  successResponse(res, course, 'Course retrieved successfully');
});

/**
 * @route   POST /api/courses
 * @desc    Create new course
 */
export const createCourse = asyncHandler(async (req, res) => {
  const { Name, Code, CreditHours, Department } = req.body;

  const existing = await prisma.course.findUnique({
    where: { Code },
  });

  if (existing) {
    throw new BadRequestError(`Course with code "${Code}" already exists`);
  }

  const course = await prisma.course.create({
    data: { Name, Code, CreditHours, Department },
  });

  successResponse(res, course, 'Course created successfully', HTTP_STATUS.CREATED);
});

/**
 * @route   PUT /api/courses/:id
 * @desc    Update course
 */
export const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const existing = await prisma.course.findUnique({
    where: { Course_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Course with ID ${id} not found`);
  }

  // Check code uniqueness if being changed
  if (data.Code && data.Code !== existing.Code) {
    const codeExists = await prisma.course.findUnique({
      where: { Code: data.Code },
    });
    if (codeExists) {
      throw new BadRequestError(`Course with code "${data.Code}" already exists`);
    }
  }

  const course = await prisma.course.update({
    where: { Course_ID: parseInt(id) },
    data,
  });

  successResponse(res, course, 'Course updated successfully');
});

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete course
 */
export const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.course.findUnique({
    where: { Course_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Course with ID ${id} not found`);
  }

  await prisma.course.delete({
    where: { Course_ID: parseInt(id) },
  });

  successResponse(res, null, 'Course deleted successfully');
});
