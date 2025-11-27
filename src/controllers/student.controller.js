import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../config/constants.js';

/**
 * @route   GET /api/students
 * @desc    Get all students
 * @access  Private
 */
export const getAllStudents = asyncHandler(async (req, res) => {
  const students = await prisma.students.findMany({
    orderBy: { Student_ID: 'asc' },
  });

  successResponse(res, students, 'Students retrieved successfully');
});

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID
 * @access  Private
 */
export const getStudentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const student = await prisma.students.findUnique({
    where: { Student_ID: parseInt(id) },
    include: {
      TimeTable: {
        select: {
          TimeTable_ID: true,
          EntryTime: true,
          ExitTime: true,
          zone: {
            select: {
              Zone_Name: true,
            },
          },
        },
        orderBy: { EntryTime: 'desc' },
        take: 10,
      },
    },
  });

  if (!student) {
    throw new NotFoundError(`Student with ID ${id} not found`);
  }

  successResponse(res, student, 'Student retrieved successfully');
});

/**
 * @route   POST /api/students
 * @desc    Create new student with 5 face pictures
 * @access  Private
 */
export const createStudent = asyncHandler(async (req, res) => {
  const { 
    Name, 
    RollNumber, 
    Email,
    Gender,
    Department,
    Face_Picture_1,
    Face_Picture_2,
    Face_Picture_3,
    Face_Picture_4,
    Face_Picture_5
  } = req.body;

  // Validate required fields
  if (!Name || !RollNumber || !Email) {
    throw new BadRequestError('Name, Roll Number, and Email are required');
  }

  // Validate at least one picture
  if (!Face_Picture_1) {
    throw new BadRequestError('At least one face picture is required');
  }

  // Check if roll number already exists
  const existingStudent = await prisma.students.findUnique({
    where: { RollNumber },
  });

  if (existingStudent) {
    throw new BadRequestError(`Student with Roll Number ${RollNumber} already exists`);
  }

  const student = await prisma.students.create({
    data: {
      Name,
      RollNumber,
      Email,
      Gender,
      Department,
      Face_Picture_1,
      Face_Picture_2,
      Face_Picture_3,
      Face_Picture_4,
      Face_Picture_5,
    },
  });

  successResponse(
    res,
    student,
    SUCCESS_MESSAGES.CREATED,
    HTTP_STATUS.CREATED
  );
});

/**
 * @route   PUT /api/students/:id
 * @desc    Update student
 * @access  Private
 */
export const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    Name, 
    RollNumber, 
    Email,
    Gender,
    Department,
    Face_Picture_1,
    Face_Picture_2,
    Face_Picture_3,
    Face_Picture_4,
    Face_Picture_5
  } = req.body;

  // Check if student exists
  const existingStudent = await prisma.students.findUnique({
    where: { Student_ID: parseInt(id) },
  });

  if (!existingStudent) {
    throw new NotFoundError(`Student with ID ${id} not found`);
  }

  // Check if new roll number conflicts with another student
  if (RollNumber && RollNumber !== existingStudent.RollNumber) {
    const rollNumberExists = await prisma.students.findUnique({
      where: { RollNumber },
    });

    if (rollNumberExists) {
      throw new BadRequestError(`Roll Number ${RollNumber} is already taken`);
    }
  }

  const updateData = {};
  if (Name !== undefined) updateData.Name = Name;
  if (RollNumber !== undefined) updateData.RollNumber = RollNumber;
  if (Email !== undefined) updateData.Email = Email;
  if (Gender !== undefined) updateData.Gender = Gender;
  if (Department !== undefined) updateData.Department = Department;
  if (Face_Picture_1 !== undefined) updateData.Face_Picture_1 = Face_Picture_1;
  if (Face_Picture_2 !== undefined) updateData.Face_Picture_2 = Face_Picture_2;
  if (Face_Picture_3 !== undefined) updateData.Face_Picture_3 = Face_Picture_3;
  if (Face_Picture_4 !== undefined) updateData.Face_Picture_4 = Face_Picture_4;
  if (Face_Picture_5 !== undefined) updateData.Face_Picture_5 = Face_Picture_5;

  // Update student
  const student = await prisma.students.update({
    where: { Student_ID: id },
    data: updateData,
    include: {
      TimeTable: {
        orderBy: { Entry_Time: 'desc' },
        take: 5,
      },
    },
  });

  // Convert base64 pictures for response
  const studentWithBase64 = {
    ...student,
    Face_Picture_1: student.Face_Picture_1 || null,
    Face_Picture_2: student.Face_Picture_2 || null,
    Face_Picture_3: student.Face_Picture_3 || null,
    Face_Picture_4: student.Face_Picture_4 || null,
    Face_Picture_5: student.Face_Picture_5 || null,
  };

  successResponse(res, studentWithBase64, SUCCESS_MESSAGES.UPDATED);
});

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete student
 * @access  Private
 */
export const deleteStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if student exists
  const existingStudent = await prisma.students.findUnique({
    where: { Student_ID: id },
  });

  if (!existingStudent) {
    throw new NotFoundError(`Student with ID ${id} not found`);
  }

  await prisma.students.delete({
    where: { Student_ID: id },
  });

  successResponse(
    res,
    { Student_ID: id },
    SUCCESS_MESSAGES.DELETED,
    HTTP_STATUS.OK
  );
});

/**
 * @route   POST /api/students/:id/face-picture
 * @desc    Upload face pictures for student (supports 1-5 pictures)
 * @access  Private
 */
export const uploadFacePicture = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { Face_Picture_1, Face_Picture_2, Face_Picture_3, Face_Picture_4, Face_Picture_5 } = req.body;

  // Check if student exists
  const existingStudent = await prisma.students.findUnique({
    where: { Student_ID: id },
  });

  if (!existingStudent) {
    throw new NotFoundError(`Student with ID ${id} not found`);
  }

  // Build update data with only provided pictures
  const updateData = {};
  if (Face_Picture_1 !== undefined) updateData.Face_Picture_1 = Face_Picture_1;
  if (Face_Picture_2 !== undefined) updateData.Face_Picture_2 = Face_Picture_2;
  if (Face_Picture_3 !== undefined) updateData.Face_Picture_3 = Face_Picture_3;
  if (Face_Picture_4 !== undefined) updateData.Face_Picture_4 = Face_Picture_4;
  if (Face_Picture_5 !== undefined) updateData.Face_Picture_5 = Face_Picture_5;

  const student = await prisma.students.update({
    where: { Student_ID: id },
    data: updateData,
    select: {
      Student_ID: true,
      Name: true,
      RollNumber: true,
      Email: true,
      Face_Picture_1: true,
      Face_Picture_2: true,
      Face_Picture_3: true,
      Face_Picture_4: true,
      Face_Picture_5: true,
    },
  });

  successResponse(res, student, 'Face pictures uploaded successfully');
});
