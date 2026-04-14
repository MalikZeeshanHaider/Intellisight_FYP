import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../config/constants.js';
import { savePersonImages, deletePersonImages } from '../services/imageSaving.service.js';

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
      AttendanceLog: {
        select: {
          Log_ID: true,
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
    Section_ID,
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

  // Validate section if provided
  let sectionIdParsed = null;
  if (Section_ID !== undefined && Section_ID !== null) {
    sectionIdParsed = parseInt(Section_ID);
    if (Number.isNaN(sectionIdParsed) || sectionIdParsed <= 0) {
      throw new BadRequestError('Section_ID must be a positive integer');
    }
    const section = await prisma.section.findUnique({ where: { Section_ID: sectionIdParsed } });
    if (!section) {
      throw new NotFoundError(`Section with ID ${Section_ID} not found`);
    }
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
      Section_ID: sectionIdParsed,
      Face_Picture_1,
      Face_Picture_2,
      Face_Picture_3,
      Face_Picture_4,
      Face_Picture_5,
    },
  });

  // Create enrollment if Section_ID provided
  if (sectionIdParsed) {
    await prisma.enrollment.create({
      data: {
        Section_ID: sectionIdParsed,
        Student_ID: student.Student_ID,
      },
    });
  }

  // Save face images to training folder for new algorithm
  try {
    await savePersonImages('student', student.Student_ID, Name, {
      Face_Picture_1,
      Face_Picture_2,
      Face_Picture_3,
      Face_Picture_4,
      Face_Picture_5
    });
  } catch (err) {
    console.warn('[STUDENT] Failed to save images to train folder:', err.message);
  }

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
    Section_ID,
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

  // Validate section if provided
  let sectionIdParsed = null;
  if (Section_ID !== undefined && Section_ID !== null) {
    sectionIdParsed = parseInt(Section_ID);
    if (Number.isNaN(sectionIdParsed) || sectionIdParsed <= 0) {
      throw new BadRequestError('Section_ID must be a positive integer');
    }
    const section = await prisma.section.findUnique({ where: { Section_ID: sectionIdParsed } });
    if (!section) {
      throw new NotFoundError(`Section with ID ${Section_ID} not found`);
    }
    // Add Section_ID to updateData so it saves to Students table
    updateData.Section_ID = sectionIdParsed;
  }

  // Update student
  const student = await prisma.students.update({
    where: { Student_ID: parseInt(id) },
    data: updateData,
    include: {
      AttendanceLog: {
        orderBy: { EntryTime: 'desc' },
        take: 5,
      },
    },
  });

  // Save updated face images to training folder for new algorithm
  if (Face_Picture_1 || Face_Picture_2 || Face_Picture_3 || Face_Picture_4 || Face_Picture_5) {
    try {
      await savePersonImages('student', student.Student_ID, student.Name, {
        Face_Picture_1: Face_Picture_1 || student.Face_Picture_1,
        Face_Picture_2: Face_Picture_2 || student.Face_Picture_2,
        Face_Picture_3: Face_Picture_3 || student.Face_Picture_3,
        Face_Picture_4: Face_Picture_4 || student.Face_Picture_4,
        Face_Picture_5: Face_Picture_5 || student.Face_Picture_5
      }, true); // isUpdate = true to clear old embeddings
    } catch (err) {
      console.warn('[STUDENT] Failed to save images to train folder:', err.message);
    }
  }

  // Upsert enrollment if Section_ID provided
  if (sectionIdParsed) {
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { Student_ID: student.Student_ID },
    });

    if (existingEnrollment) {
      if (existingEnrollment.Section_ID !== sectionIdParsed) {
        await prisma.enrollment.update({
          where: { Enrollment_ID: existingEnrollment.Enrollment_ID },
          data: { Section_ID: sectionIdParsed },
        });
      }
    } else {
      await prisma.enrollment.create({
        data: {
          Section_ID: sectionIdParsed,
          Student_ID: student.Student_ID,
        },
      });
    }
  }

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
    where: { Student_ID: parseInt(id) },
  });

  if (!existingStudent) {
    throw new NotFoundError(`Student with ID ${id} not found`);
  }

  // Delete face images from training folder
  try {
    await deletePersonImages(existingStudent.Name);
  } catch (err) {
    console.warn('[STUDENT] Failed to delete images from train folder:', err.message);
  }

  await prisma.students.delete({
    where: { Student_ID: parseInt(id) },
  });

  successResponse(
    res,
    { Student_ID: parseInt(id) },
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
    where: { Student_ID: parseInt(id) },
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
    where: { Student_ID: parseInt(id) },
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
