import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * @route   GET /api/enrollments/section/:sectionId
 * @desc    Get all enrollments for a section
 */
export const getEnrollmentsBySection = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const section = await prisma.section.findUnique({
    where: { Section_ID: parseInt(sectionId) },
  });

  if (!section) {
    throw new NotFoundError(`Section with ID ${sectionId} not found`);
  }

  // Get students by their Section_ID field directly from the Students table
  let students = await prisma.students.findMany({
    where: { Section_ID: parseInt(sectionId) },
    select: {
      Student_ID: true,
      Name: true,
      RollNumber: true,
      Email: true,
      Department: true,
      Gender: true,
    },
    orderBy: { Name: 'asc' },
  });

  if (!students || students.length === 0) {
    const enrolls = await prisma.enrollment.findMany({
      where: { Section_ID: parseInt(sectionId) },
      include: {
        student: { select: { Student_ID: true, Name: true, RollNumber: true, Email: true, Department: true, Gender: true } }
      }
    });
    students = enrolls.map(e => e.student).filter(Boolean);
  }

  // Deduplicate
  const uniqueMap = new Map();
  for (const s of students) {
    uniqueMap.set(s.Student_ID, s);
  }
  const uniqueStudents = Array.from(uniqueMap.values()).sort((a,b) => (a.Name||'').localeCompare(b.Name||''));

  // Map to match the expected format for the frontend
  const enrollments = uniqueStudents.map(student => ({ student }));

  successResponse(res, {
    section,
    enrolledCount: enrollments.length,
    enrollments,
  }, 'Enrollments retrieved successfully');
});

/**
 * @route   POST /api/enrollments
 * @desc    Enroll a single student in a section
 */
export const createEnrollment = asyncHandler(async (req, res) => {
  const { Section_ID, Student_ID } = req.body;

  // Verify section exists
  const section = await prisma.section.findUnique({
    where: { Section_ID },
  });
  if (!section) {
    throw new NotFoundError(`Section with ID ${Section_ID} not found`);
  }

  // Verify student exists
  const student = await prisma.students.findUnique({
    where: { Student_ID },
  });
  if (!student) {
    throw new NotFoundError(`Student with ID ${Student_ID} not found`);
  }

  // Check duplicate
  const existing = await prisma.enrollment.findUnique({
    where: {
      Section_ID_Student_ID: { Section_ID, Student_ID },
    },
  });
  if (existing) {
    throw new ConflictError(`Student ${Student_ID} is already enrolled in section ${Section_ID}`);
  }

  const enrollment = await prisma.enrollment.create({
    data: { Section_ID, Student_ID },
    include: {
      student: {
        select: { Student_ID: true, Name: true, RollNumber: true },
      },
      section: {
        select: { Section_ID: true, Name: true },
      },
    },
  });

  successResponse(res, enrollment, 'Student enrolled successfully', HTTP_STATUS.CREATED);
});

/**
 * @route   POST /api/enrollments/bulk
 * @desc    Bulk enroll multiple students in a section
 */
export const bulkEnroll = asyncHandler(async (req, res) => {
  const { Section_ID, Student_IDs } = req.body;

  // Verify section exists
  const section = await prisma.section.findUnique({
    where: { Section_ID },
  });
  if (!section) {
    throw new NotFoundError(`Section with ID ${Section_ID} not found`);
  }

  // Verify all students exist
  const students = await prisma.students.findMany({
    where: { Student_ID: { in: Student_IDs } },
    select: { Student_ID: true },
  });

  const foundIds = students.map(s => s.Student_ID);
  const missingIds = Student_IDs.filter(id => !foundIds.includes(id));

  if (missingIds.length > 0) {
    throw new BadRequestError(`Students not found: ${missingIds.join(', ')}`);
  }

  // Check existing enrollments
  const existing = await prisma.enrollment.findMany({
    where: {
      Section_ID,
      Student_ID: { in: Student_IDs },
    },
    select: { Student_ID: true },
  });

  const alreadyEnrolled = existing.map(e => e.Student_ID);
  const newStudentIds = Student_IDs.filter(id => !alreadyEnrolled.includes(id));

  if (newStudentIds.length === 0) {
    throw new ConflictError('All students are already enrolled in this section');
  }

  // Bulk create
  const result = await prisma.enrollment.createMany({
    data: newStudentIds.map(Student_ID => ({
      Section_ID,
      Student_ID,
    })),
  });

  successResponse(res, {
    enrolled: result.count,
    skippedAlreadyEnrolled: alreadyEnrolled.length,
    alreadyEnrolledIds: alreadyEnrolled,
  }, `${result.count} students enrolled successfully`, HTTP_STATUS.CREATED);
});

/**
 * @route   DELETE /api/enrollments/:id
 * @desc    Remove an enrollment
 */
export const deleteEnrollment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.enrollment.findUnique({
    where: { Enrollment_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Enrollment with ID ${id} not found`);
  }

  await prisma.enrollment.delete({
    where: { Enrollment_ID: parseInt(id) },
  });

  successResponse(res, null, 'Enrollment removed successfully');
});

/**
 * @route   GET /api/enrollments/student/:studentId
 * @desc    Get all sections a student is enrolled in
 */
export const getStudentEnrollments = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const student = await prisma.students.findUnique({
    where: { Student_ID: parseInt(studentId) },
    select: { Student_ID: true, Name: true, RollNumber: true },
  });

  if (!student) {
    throw new NotFoundError(`Student with ID ${studentId} not found`);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { Student_ID: parseInt(studentId) },
    include: {
      section: true,
    },
  });

  successResponse(res, {
    student,
    sections: enrollments.map(e => e.section),
  }, 'Student enrollments retrieved successfully');
});
