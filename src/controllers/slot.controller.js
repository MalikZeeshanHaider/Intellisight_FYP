import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Check if two time ranges overlap
 */
function timesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

/**
 * Check for teacher/section time conflicts
 */
async function checkOverlaps({ Section_ID, Teacher_ID, DayOfWeek, StartTime, EndTime, excludeSlotId }) {
  const conflicts = [];

  // Check section overlap - no two classes for same section at same time
  const sectionSlots = await prisma.timetableSlot.findMany({
    where: {
      Section_ID,
      DayOfWeek,
      IsActive: true,
      ...(excludeSlotId ? { NOT: { Slot_ID: excludeSlotId } } : {}),
    },
    include: {
      section: { select: { Name: true } },
    },
  });

  for (const slot of sectionSlots) {
    if (timesOverlap(StartTime, EndTime, slot.StartTime, slot.EndTime)) {
      conflicts.push({
        type: 'SECTION_CONFLICT',
        message: `Section already has "${slot.SubjectName}" on ${slot.DayOfWeek} ${slot.StartTime}-${slot.EndTime}`,
        conflictingSlot: slot,
      });
    }
  }

  // Check teacher overlap - teacher can't be in two places at once
  if (Teacher_ID) {
    const teacherSlots = await prisma.timetableSlot.findMany({
      where: {
        Teacher_ID,
        DayOfWeek,
        IsActive: true,
        ...(excludeSlotId ? { NOT: { Slot_ID: excludeSlotId } } : {}),
      },
      include: {
        section: { select: { Name: true } },
        teacher: { select: { Name: true } },
      },
    });

    for (const slot of teacherSlots) {
      if (timesOverlap(StartTime, EndTime, slot.StartTime, slot.EndTime)) {
        conflicts.push({
          type: 'TEACHER_CONFLICT',
          message: `Teacher "${slot.teacher?.Name}" already teaching "${slot.SubjectName}" for ${slot.section?.Name} on ${slot.DayOfWeek} ${slot.StartTime}-${slot.EndTime}`,
          conflictingSlot: slot,
        });
      }
    }
  }

  return conflicts;
}

/**
 * @route   GET /api/slots
 * @desc    Get all timetable slots (with filters)
 */
export const getAllSlots = asyncHandler(async (req, res) => {
  const { sectionId, teacherId, dayOfWeek, zoneId, active } = req.query;

  const where = {};
  if (sectionId) where.Section_ID = parseInt(sectionId);
  if (teacherId) where.Teacher_ID = parseInt(teacherId);
  if (dayOfWeek) where.DayOfWeek = dayOfWeek.toUpperCase();
  if (zoneId) where.Zone_id = parseInt(zoneId);
  if (active !== undefined) where.IsActive = active === 'true';

  const slots = await prisma.timetableSlot.findMany({
    where,
    include: {
      section: { select: { Section_ID: true, Name: true } },
      course: { select: { Course_ID: true, Name: true, Code: true } },
      teacher: { select: { Teacher_ID: true, Name: true, Email: true } },
      zone: { select: { Zone_id: true, Zone_Name: true } },
    },
    orderBy: [{ DayOfWeek: 'asc' }, { StartTime: 'asc' }],
  });

  successResponse(res, slots, 'Timetable slots retrieved successfully');
});

/**
 * @route   GET /api/slots/:id
 * @desc    Get slot by ID
 */
export const getSlotById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const slot = await prisma.timetableSlot.findUnique({
    where: { Slot_ID: parseInt(id) },
    include: {
      section: true,
      course: true,
      teacher: { select: { Teacher_ID: true, Name: true, Email: true } },
      zone: { select: { Zone_id: true, Zone_Name: true } },
      ClassAttendance: {
        take: 10,
        orderBy: { Date: 'desc' },
      },
    },
  });

  if (!slot) {
    throw new NotFoundError(`Slot with ID ${id} not found`);
  }

  successResponse(res, slot, 'Slot retrieved successfully');
});

/**
 * @route   GET /api/slots/section/:sectionId
 * @desc    Get full timetable grid for a section
 */
export const getSlotsBySection = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const section = await prisma.section.findUnique({
    where: { Section_ID: parseInt(sectionId) },
  });

  if (!section) {
    throw new NotFoundError(`Section with ID ${sectionId} not found`);
  }

  const slots = await prisma.timetableSlot.findMany({
    where: {
      Section_ID: parseInt(sectionId),
      IsActive: true,
    },
    include: {
      course: { select: { Course_ID: true, Name: true, Code: true } },
      teacher: { select: { Teacher_ID: true, Name: true } },
      zone: { select: { Zone_id: true, Zone_Name: true } },
    },
    orderBy: [{ DayOfWeek: 'asc' }, { StartTime: 'asc' }],
  });

  // Group by day for grid view
  const grid = {};
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  for (const day of DAYS) {
    grid[day] = slots.filter(s => s.DayOfWeek === day);
  }

  successResponse(res, {
    section,
    grid,
    totalSlots: slots.length,
  }, 'Section timetable retrieved successfully');
});

/**
 * @route   POST /api/slots
 * @desc    Create a single timetable slot
 */
export const createSlot = asyncHandler(async (req, res) => {
  const data = req.body;

  // Verify section exists
  const section = await prisma.section.findUnique({
    where: { Section_ID: data.Section_ID },
  });
  if (!section) {
    throw new NotFoundError(`Section with ID ${data.Section_ID} not found`);
  }

  // Verify teacher if provided
  if (data.Teacher_ID) {
    const teacher = await prisma.teacher.findUnique({
      where: { Teacher_ID: data.Teacher_ID },
    });
    if (!teacher) {
      throw new NotFoundError(`Teacher with ID ${data.Teacher_ID} not found`);
    }
  }

  // Verify zone if provided
  if (data.Zone_id) {
    const zone = await prisma.zone.findUnique({
      where: { Zone_id: data.Zone_id },
    });
    if (!zone) {
      throw new NotFoundError(`Zone with ID ${data.Zone_id} not found`);
    }
  }

  // Verify course if provided
  if (data.Course_ID) {
    const course = await prisma.course.findUnique({
      where: { Course_ID: data.Course_ID },
    });
    if (!course) {
      throw new NotFoundError(`Course with ID ${data.Course_ID} not found`);
    }
  }

  // Check for overlaps
  const conflicts = await checkOverlaps({
    Section_ID: data.Section_ID,
    Teacher_ID: data.Teacher_ID,
    DayOfWeek: data.DayOfWeek,
    StartTime: data.StartTime,
    EndTime: data.EndTime,
  });

  if (conflicts.length > 0) {
    throw new ConflictError(
      `Schedule conflicts detected: ${conflicts.map(c => c.message).join('; ')}`
    );
  }

  const slot = await prisma.timetableSlot.create({
    data: {
      Section_ID: data.Section_ID,
      Course_ID: data.Course_ID || null,
      Teacher_ID: data.Teacher_ID || null,
      TeacherName: data.TeacherName || null,
      SubjectName: data.SubjectName,
      DayOfWeek: data.DayOfWeek,
      StartTime: data.StartTime,
      EndTime: data.EndTime,
      Zone_id: data.Zone_id || null,
      RoomName: data.RoomName || null,
      IsActive: data.IsActive !== undefined ? data.IsActive : true,
    },
    include: {
      section: { select: { Name: true } },
      course: { select: { Name: true, Code: true } },
      teacher: { select: { Name: true } },
      zone: { select: { Zone_Name: true } },
    },
  });

  successResponse(res, slot, 'Timetable slot created successfully', HTTP_STATUS.CREATED);
});

/**
 * @route   POST /api/slots/bulk
 * @desc    Bulk create timetable slots (for manual grid or AI import)
 */
export const bulkCreateSlots = asyncHandler(async (req, res) => {
  const { slots: slotsData } = req.body;

  const results = {
    created: [],
    errors: [],
  };

  for (let i = 0; i < slotsData.length; i++) {
    const data = slotsData[i];
    try {
      // Check overlaps
      const conflicts = await checkOverlaps({
        Section_ID: data.Section_ID,
        Teacher_ID: data.Teacher_ID,
        DayOfWeek: data.DayOfWeek,
        StartTime: data.StartTime,
        EndTime: data.EndTime,
      });

      if (conflicts.length > 0) {
        results.errors.push({
          index: i,
          slot: data,
          reason: conflicts.map(c => c.message).join('; '),
        });
        continue;
      }

      const slot = await prisma.timetableSlot.create({
        data: {
          Section_ID: data.Section_ID,
          Course_ID: data.Course_ID || null,
          Teacher_ID: data.Teacher_ID || null,
          TeacherName: data.TeacherName || null,
          SubjectName: data.SubjectName,
          DayOfWeek: data.DayOfWeek,
          StartTime: data.StartTime,
          EndTime: data.EndTime,
          Zone_id: data.Zone_id || null,
          RoomName: data.RoomName || null,
          IsActive: data.IsActive !== undefined ? data.IsActive : true,
        },
      });

      results.created.push(slot);
    } catch (err) {
      results.errors.push({
        index: i,
        slot: data,
        reason: err.message,
      });
    }
  }

  const status = results.errors.length > 0 && results.created.length > 0
    ? HTTP_STATUS.OK
    : results.created.length > 0
      ? HTTP_STATUS.CREATED
      : HTTP_STATUS.BAD_REQUEST;

  successResponse(res, results,
    `${results.created.length} slots created, ${results.errors.length} failed`,
    status
  );
});

/**
 * @route   PUT /api/slots/:id
 * @desc    Update a timetable slot
 */
export const updateSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const existing = await prisma.timetableSlot.findUnique({
    where: { Slot_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Slot with ID ${id} not found`);
  }

  // Check overlaps if time/day/section changed
  const needsOverlapCheck =
    data.DayOfWeek || data.StartTime || data.EndTime || data.Section_ID || data.Teacher_ID;

  if (needsOverlapCheck) {
    const conflicts = await checkOverlaps({
      Section_ID: data.Section_ID || existing.Section_ID,
      Teacher_ID: data.Teacher_ID !== undefined ? data.Teacher_ID : existing.Teacher_ID,
      DayOfWeek: data.DayOfWeek || existing.DayOfWeek,
      StartTime: data.StartTime || existing.StartTime,
      EndTime: data.EndTime || existing.EndTime,
      excludeSlotId: parseInt(id),
    });

    if (conflicts.length > 0) {
      throw new ConflictError(
        `Schedule conflicts detected: ${conflicts.map(c => c.message).join('; ')}`
      );
    }
  }

  const slot = await prisma.timetableSlot.update({
    where: { Slot_ID: parseInt(id) },
    data,
    include: {
      section: { select: { Name: true } },
      course: { select: { Name: true, Code: true } },
      teacher: { select: { Name: true } },
      zone: { select: { Zone_Name: true } },
    },
  });

  successResponse(res, slot, 'Timetable slot updated successfully');
});

/**
 * @route   DELETE /api/slots/:id
 * @desc    Delete a timetable slot
 */
export const deleteSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.timetableSlot.findUnique({
    where: { Slot_ID: parseInt(id) },
  });

  if (!existing) {
    throw new NotFoundError(`Slot with ID ${id} not found`);
  }

  await prisma.timetableSlot.delete({
    where: { Slot_ID: parseInt(id) },
  });

  successResponse(res, null, 'Timetable slot deleted successfully');
});

/**
 * @route   POST /api/slots/check-overlaps
 * @desc    Check for overlaps without creating (preview for UI)
 */
export const checkSlotOverlaps = asyncHandler(async (req, res) => {
  const { Section_ID, Teacher_ID, DayOfWeek, StartTime, EndTime, excludeSlotId } = req.body;

  const conflicts = await checkOverlaps({
    Section_ID,
    Teacher_ID,
    DayOfWeek,
    StartTime,
    EndTime,
    excludeSlotId,
  });

  successResponse(res, {
    hasConflicts: conflicts.length > 0,
    conflicts,
  }, conflicts.length > 0 ? 'Conflicts found' : 'No conflicts');
});
