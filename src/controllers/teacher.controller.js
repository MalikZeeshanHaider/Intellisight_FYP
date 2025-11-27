import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../config/constants.js';

/**
 * @route   GET /api/teachers
 * @desc    Get all teachers
 * @access  Private
 */
export const getAllTeachers = asyncHandler(async (req, res) => {
  const teachers = await prisma.teacher.findMany({
    orderBy: { Teacher_ID: 'asc' },
  });

  successResponse(res, teachers, 'Teachers retrieved successfully');
});

/**
 * @route   GET /api/teachers/:id
 * @desc    Get teacher by ID
 * @access  Private
 */
export const getTeacherById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await prisma.teacher.findUnique({
    where: { Teacher_ID: parseInt(id) },
    include: {
      TimeTable: {
        orderBy: { EntryTime: 'desc' },
        take: 10,
      },
    },
  });

  if (!teacher) {
    throw new NotFoundError(`Teacher with ID ${id} not found`);
  }

  successResponse(res, teacher, 'Teacher retrieved successfully');
});

/**
 * @route   POST /api/teachers
 * @desc    Create new teacher with 5 face pictures
 * @access  Private
 */
export const createTeacher = asyncHandler(async (req, res) => {
  const { 
    Name, 
    Email,
    Gender,
    Faculty_Type,
    Department,
    Face_Picture_1,
    Face_Picture_2,
    Face_Picture_3,
    Face_Picture_4,
    Face_Picture_5
  } = req.body;

  // Validate required fields
  if (!Name || !Email) {
    throw new BadRequestError('Name and Email are required');
  }

  // Validate at least one picture
  if (!Face_Picture_1) {
    throw new BadRequestError('At least one face picture is required');
  }

  // Validate Department is required for Permanent faculty
  if (Faculty_Type === 'Permanent' && !Department) {
    throw new BadRequestError('Department is required for Permanent faculty');
  }

  // Check if email already exists
  const existingTeacher = await prisma.teacher.findUnique({
    where: { Email },
  });

  if (existingTeacher) {
    throw new BadRequestError(`Teacher with Email ${Email} already exists`);
  }

  const teacher = await prisma.teacher.create({
    data: {
      Name,
      Email,
      Gender,
      Faculty_Type,
      Department: Faculty_Type === 'Permanent' ? Department : null,
      Face_Picture_1,
      Face_Picture_2,
      Face_Picture_3,
      Face_Picture_4,
      Face_Picture_5,
    },
  });

  successResponse(
    res,
    teacher,
    SUCCESS_MESSAGES.CREATED,
    HTTP_STATUS.CREATED
  );
});

/**
 * @route   PUT /api/teachers/:id
 * @desc    Update teacher
 * @access  Private
 */
export const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    Name, 
    Email,
    Gender,
    Faculty_Type,
    Department,
    Face_Picture_1,
    Face_Picture_2,
    Face_Picture_3,
    Face_Picture_4,
    Face_Picture_5
  } = req.body;

  // Check if teacher exists
  const existingTeacher = await prisma.teacher.findUnique({
    where: { Teacher_ID: parseInt(id) },
  });

  if (!existingTeacher) {
    throw new NotFoundError(`Teacher with ID ${id} not found`);
  }

  const updateData = {};
  if (Name !== undefined) updateData.Name = Name;
  if (Email !== undefined) updateData.Email = Email;
  if (Gender !== undefined) updateData.Gender = Gender;
  if (Faculty_Type !== undefined) updateData.Faculty_Type = Faculty_Type;
  if (Department !== undefined) updateData.Department = Department;
  if (Face_Picture_1 !== undefined) updateData.Face_Picture_1 = Face_Picture_1;
  if (Face_Picture_2 !== undefined) updateData.Face_Picture_2 = Face_Picture_2;
  if (Face_Picture_3 !== undefined) updateData.Face_Picture_3 = Face_Picture_3;
  if (Face_Picture_4 !== undefined) updateData.Face_Picture_4 = Face_Picture_4;
  if (Face_Picture_5 !== undefined) updateData.Face_Picture_5 = Face_Picture_5;

  const teacher = await prisma.teacher.update({
    where: { Teacher_ID: parseInt(id) },
    data: updateData,
    include: {
      TimeTable: {
        orderBy: { EntryTime: 'desc' },
        take: 5,
      },
    },
  });

  successResponse(res, teacher, SUCCESS_MESSAGES.UPDATED);
});

/**
 * @route   DELETE /api/teachers/:id
 * @desc    Delete teacher
 * @access  Private
 */
export const deleteTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if teacher exists
  const existingTeacher = await prisma.teacher.findUnique({
    where: { Teacher_ID: parseInt(id) },
  });

  if (!existingTeacher) {
    throw new NotFoundError(`Teacher with ID ${id} not found`);
  }

  // Delete related TimeTable entries first
  await prisma.timeTable.deleteMany({
    where: { Teacher_ID: parseInt(id) },
  });

  // Now delete the teacher
  await prisma.teacher.delete({
    where: { Teacher_ID: parseInt(id) },
  });

  successResponse(
    res,
    { Teacher_ID: id },
    SUCCESS_MESSAGES.DELETED,
    HTTP_STATUS.OK
  );
});

/**
 * @route   POST /api/teachers/:id/face-picture
 * @desc    Upload face picture for teacher
 * @access  Private
 */
export const uploadFacePicture = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { Face_Pictures } = req.body;

  // Check if teacher exists
  const existingTeacher = await prisma.teacher.findUnique({
    where: { Teacher_ID: id },
  });

  if (!existingTeacher) {
    throw new NotFoundError(`Teacher with ID ${id} not found`);
  }

  // Validate and accept base64 string
  uploadService.validateImageSize(Face_Pictures);

  const teacher = await prisma.teacher.update({
    where: { Teacher_ID: id },
    data: { Face_Pictures },
    select: {
      Teacher_ID: true,
      Name: true,
      Email: true,
      Face_Pictures: true,
    },
  });

  // Return base64 string as-is for response
  const teacherWithBase64 = {
    ...teacher,
    Face_Pictures: teacher.Face_Pictures || null,
  };

  successResponse(res, teacherWithBase64, 'Face picture uploaded successfully');
});
