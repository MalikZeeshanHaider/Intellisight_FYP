import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { HTTP_STATUS, PERSON_TYPES } from '../config/constants.js';
import { aggregateAttendance, aggregateWeek } from '../services/attendanceAggregation.service.js';

/**
 * @route   POST /api/class-attendance/aggregate
 * @desc    Trigger attendance aggregation for a specific date
 *          Processes camera logs → ClassAttendance records
 */
export const triggerAggregation = asyncHandler(async (req, res) => {
  const { date, sectionId, slotId } = req.body;

  const result = await aggregateAttendance(date, sectionId, slotId);

  successResponse(res, result, 'Attendance aggregation completed', HTTP_STATUS.OK);
});

/**
 * @route   POST /api/class-attendance/aggregate-week
 * @desc    Trigger attendance aggregation for a week range
 */
export const triggerWeekAggregation = asyncHandler(async (req, res) => {
  const { startDate, endDate, sectionId } = req.body;

  if (!startDate || !endDate) {
    throw new BadRequestError('startDate and endDate are required (YYYY-MM-DD)');
  }

  const result = await aggregateWeek(startDate, endDate, sectionId);

  successResponse(res, result, 'Week aggregation completed', HTTP_STATUS.OK);
});

/**
 * @route   GET /api/class-attendance
 * @desc    Query class attendance records with filters
 */
export const getClassAttendance = asyncHandler(async (req, res) => {
  const { slotId, sectionId, date, from, to, studentId, teacherId, status, autoAggregate } = req.query;

  // Auto-aggregate for the date to ensure realtime data if requested (default true for single date)
  if (date && String(autoAggregate) !== 'false') {
    // Only auto-aggregate if it's for a single date
    try {
      await aggregateAttendance(date, sectionId ? Number(sectionId) : null, slotId ? Number(slotId) : null);
    } catch (e) {
      console.error('[AUTO-AGGREGATE ERROR]', e.message);
    }
  }

  const where = {};

  if (slotId) where.Slot_ID = slotId;
  if (studentId) where.Student_ID = studentId;
  if (teacherId) where.Teacher_ID = teacherId;
  if (status) where.Status = status;

  if (date) {
    where.Date = new Date(date);
  } else if (from || to) {
    where.Date = {};
    if (from) where.Date.gte = new Date(from);
    if (to) where.Date.lte = new Date(to);
  }

  if (sectionId) {
    where.slot = { Section_ID: sectionId };
  }

  const records = await prisma.classAttendance.findMany({
    where,
    include: {
      slot: {
        select: {
          Slot_ID: true,
          SubjectName: true,
          DayOfWeek: true,
          StartTime: true,
          EndTime: true,
          section: { select: { Section_ID: true, Name: true } },
          teacher: { select: { Teacher_ID: true, Name: true } },
          zone: { select: { Zone_id: true, Zone_Name: true } },
          course: { select: { Course_ID: true, Name: true, Code: true } },
        },
      },
      student: {
        select: { Student_ID: true, Name: true, RollNumber: true },
      },
      teacher: {
        select: { Teacher_ID: true, Name: true },
      },
    },
    orderBy: [{ Date: 'desc' }, { Slot_ID: 'asc' }],
  });

  successResponse(res, records, 'Class attendance records retrieved');
});

/**
 * @route   GET /api/class-attendance/slot/:slotId
 * @desc    Get attendance for a specific slot on a specific date
 *          Returns each student's status + teacher status
 */
export const getSlotAttendance = asyncHandler(async (req, res) => {
  const { slotId } = req.params;
  const { date, autoAggregate } = req.query;

  if (date && String(autoAggregate) !== 'false') {
    try {
      await aggregateAttendance(date, null, parseInt(slotId));
    } catch (e) {
      console.error('[AUTO-AGGREGATE ERROR]', e.message);
    }
  }

  const slot = await prisma.timetableSlot.findUnique({
    where: { Slot_ID: parseInt(slotId) },
    include: {
      section: true,
      teacher: { select: { Teacher_ID: true, Name: true } },
      zone: { select: { Zone_id: true, Zone_Name: true } },
      course: { select: { Course_ID: true, Name: true, Code: true } },
    },
  });

  if (!slot) {
    throw new NotFoundError(`Slot with ID ${slotId} not found`);
  }

  // Get students who belong to this section
  const students = await prisma.students.findMany({
    where: { Section_ID: slot.Section_ID },
    select: { Student_ID: true, Name: true, RollNumber: true },
  });

  const enrollments = students.map(student => ({ student }));

  // Get attendance records for this date
  const attendanceRecords = await prisma.classAttendance.findMany({
    where: {
      Slot_ID: parseInt(slotId),
      Date: new Date(date),
    },
  });

  // Build per-student attendance map
  const attendanceMap = {};
  for (const rec of attendanceRecords) {
    if (rec.Student_ID) attendanceMap[`S_${rec.Student_ID}`] = rec;
    if (rec.Teacher_ID) attendanceMap[`T_${rec.Teacher_ID}`] = rec;
  }

  // Build student attendance list
  const studentAttendance = enrollments.map(e => {
    const record = attendanceMap[`S_${e.student.Student_ID}`];
    return {
      student: e.student,
      status: record ? record.Status : 'NOT_PROCESSED',
      firstSeenAt: record?.FirstSeenAt || null,
      lastSeenAt: record?.LastSeenAt || null,
      totalMinutes: record?.TotalMinutes || 0,
      detectionsCount: record?.DetectionsCount || 0,
    };
  });

  // Teacher attendance
  const teacherRecord = slot.Teacher_ID
    ? attendanceMap[`T_${slot.Teacher_ID}`]
    : null;

  const teacherAttendance = slot.teacher
    ? {
        teacher: slot.teacher,
        status: teacherRecord ? teacherRecord.Status : 'NOT_PROCESSED',
        firstSeenAt: teacherRecord?.FirstSeenAt || null,
        lastSeenAt: teacherRecord?.LastSeenAt || null,
        totalMinutes: teacherRecord?.TotalMinutes || 0,
        detectionsCount: teacherRecord?.DetectionsCount || 0,
      }
    : null;

  // Summary counts
  const presentCount = studentAttendance.filter(s => s.status === 'PRESENT').length;
  const absentCount = studentAttendance.filter(s => s.status === 'ABSENT').length;
  const lateCount = studentAttendance.filter(s => s.status === 'LATE').length;

  successResponse(res, {
    slot,
    date,
    summary: {
      totalEnrolled: enrollments.length,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      attendanceRate: enrollments.length > 0
        ? Math.round(((presentCount + lateCount) / enrollments.length) * 100)
        : 0,
    },
    teacherAttendance,
    studentAttendance,
  }, 'Slot attendance retrieved');
});

/**
 * @route   GET /api/class-attendance/student/:studentId/weekly
 * @desc    "Where is this student during the week?" – timetable grid with attendance dots
 * @query   weekStart=YYYY-MM-DD (Monday of the week)
 */
export const getStudentWeeklyView = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { weekStart, autoAggregate } = req.query;

  // Verify student
  const student = await prisma.students.findUnique({
    where: { Student_ID: parseInt(studentId) },
    select: { Student_ID: true, Name: true, RollNumber: true, Section_ID: true },
  });

  if (!student) {
    throw new NotFoundError(`Student with ID ${studentId} not found`);
  }

  if (String(autoAggregate) !== 'false') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekStartDate = new Date(weekStart);
      const current = new Date(weekStartDate);
      while (current.toISOString().split('T')[0] <= today) {
        const dateStr = current.toISOString().split('T')[0];
        await aggregateAttendance(dateStr, student.Section_ID || null);
        current.setDate(current.getDate() + 1);
      }
    } catch (e) {
      console.error('[AUTO-AGGREGATE ERROR]', e.message);
    }
  }

  // Find student's sections
  if (!student.Section_ID) {
    return successResponse(res, {
      student,
      weekStart,
      sections: [],
      grid: {},
    }, 'Student is not assigned to any section');
  }

  const sectionIds = [student.Section_ID];

  // Get all slots for student's sections
  const slots = await prisma.timetableSlot.findMany({
    where: {
      Section_ID: { in: sectionIds },
      IsActive: true,
    },
    include: {
      section: { select: { Name: true } },
      course: { select: { Name: true, Code: true } },
      teacher: { select: { Name: true } },
      zone: { select: { Zone_Name: true } },
    },
    orderBy: [{ DayOfWeek: 'asc' }, { StartTime: 'asc' }],
  });

  // Build week dates
  const weekDates = {};
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const startDate = new Date(weekStart);

  for (let i = 0; i < 6; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    weekDates[DAYS[i]] = d;
  }

  // Get attendance records for the week
  const weekEnd = new Date(startDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const attendanceRecords = await prisma.classAttendance.findMany({
    where: {
      Student_ID: parseInt(studentId),
      Date: {
        gte: startDate,
        lte: weekEnd,
      },
    },
  });

  // Build attendance lookup: "slotId_date" → record
  const attendanceLookup = {};
  for (const rec of attendanceRecords) {
    const dateKey = rec.Date.toISOString().split('T')[0];
    attendanceLookup[`${rec.Slot_ID}_${dateKey}`] = rec;
  }

  // Build grid: day → [{ slot info + attendance }]
  const grid = {};
  for (const day of DAYS) {
    const daySlots = slots.filter(s => s.DayOfWeek === day);
    const dateStr = weekDates[day]?.toISOString().split('T')[0];

    grid[day] = {
      date: dateStr,
      slots: daySlots.map(slot => {
        const key = `${slot.Slot_ID}_${dateStr}`;
        const attendance = attendanceLookup[key];
        return {
          slot: {
            Slot_ID: slot.Slot_ID,
            SubjectName: slot.SubjectName,
            StartTime: slot.StartTime,
            EndTime: slot.EndTime,
            section: slot.section,
            course: slot.course,
            teacher: slot.teacher,
            zone: slot.zone,
          },
          attendance: attendance
            ? {
                status: attendance.Status,
                firstSeenAt: attendance.FirstSeenAt,
                lastSeenAt: attendance.LastSeenAt,
                totalMinutes: attendance.TotalMinutes,
                detectionsCount: attendance.DetectionsCount,
              }
            : { status: 'NOT_PROCESSED' },
        };
      }),
    };
  }

  // Summary stats
  let totalSlots = 0;
  let present = 0;
  let absent = 0;
  let late = 0;
  for (const day of DAYS) {
    for (const entry of grid[day].slots) {
      totalSlots++;
      if (entry.attendance.status === 'PRESENT') present++;
      else if (entry.attendance.status === 'ABSENT') absent++;
      else if (entry.attendance.status === 'LATE') late++;
    }
  }

  const sectionDocs = student.Section_ID ? await prisma.section.findMany({ where: { Section_ID: student.Section_ID } }) : [];

  successResponse(res, {
    student,
    weekStart,
    sections: sectionDocs,
    summary: {
      totalSlots,
      present,
      absent,
      late,
      attendanceRate: (present + absent + late) > 0 ? Math.round(((present + late) / (present + absent + late)) * 100) : 100,
    },
    grid,
  }, 'Student weekly view retrieved');
});

/**
 * @route   GET /api/class-attendance/section/:sectionId/weekly
 * @desc    "How many students attended each class?" – heatmap/dot view
 * @query   weekStart=YYYY-MM-DD
 */
export const getSectionWeeklyHeatmap = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const { weekStart, autoAggregate } = req.query;

  // Auto-aggregate all past days in the requested week so stale ABSENT records get refreshed.
  if (String(autoAggregate) !== 'false') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekStartDate = new Date(weekStart);
      const current = new Date(weekStartDate);
      // Re-aggregate each day from weekStart up to (and including) today
      while (current.toISOString().split('T')[0] <= today) {
        const dateStr = current.toISOString().split('T')[0];
        await aggregateAttendance(dateStr, parseInt(sectionId));
        current.setDate(current.getDate() + 1);
      }
    } catch (e) {
      console.error('[AUTO-AGGREGATE ERROR]', e.message);
    }
  }

  // Verify section
  const section = await prisma.section.findUnique({
    where: { Section_ID: parseInt(sectionId) },
  });

  if (!section) {
    throw new NotFoundError(`Section with ID ${sectionId} not found`);
  }

  // Get students who belong to this section
  let students = await prisma.students.findMany({
    where: { Section_ID: parseInt(sectionId) },
    select: { Student_ID: true, Name: true, RollNumber: true, Department: true, Gender: true },
    orderBy: { Name: 'asc' },
  });

  // Fallback to enrollments table if direct Section_ID is empty
  if (!students || students.length === 0) {
    const enrolls = await prisma.enrollment.findMany({
      where: { Section_ID: parseInt(sectionId) },
      include: {
        student: { select: { Student_ID: true, Name: true, RollNumber: true, Department: true, Gender: true } }
      }
    });
    students = enrolls.map(e => e.student).filter(Boolean);
  }

  // Deduplicate
  const uniqueStudentsMap = new Map();
  for (const s of students) {
    if (!uniqueStudentsMap.has(s.Student_ID)) {
      uniqueStudentsMap.set(s.Student_ID, s);
    }
  }
  const uniqueStudents = Array.from(uniqueStudentsMap.values()).sort((a,b) => (a.Name || '').localeCompare(b.Name || ''));

  const enrollments = uniqueStudents.map(student => ({ student }));

  const enrolledCount = enrollments.length;
  const studentIds = enrollments.map(e => e.student.Student_ID);

  // Get slots
  const slots = await prisma.timetableSlot.findMany({
    where: {
      Section_ID: parseInt(sectionId),
      IsActive: true,
    },
    include: {
      course: { select: { Name: true, Code: true } },
      teacher: { select: { Name: true } },
      zone: { select: { Zone_Name: true } },
    },
    orderBy: [{ DayOfWeek: 'asc' }, { StartTime: 'asc' }],
  });

  // Build week dates
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const startDate = new Date(weekStart);
  const weekEnd = new Date(startDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekDates = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    weekDates[DAYS[i]] = d.toISOString().split('T')[0];
  }

  // Get all attendance records (students + teacher) for this section's slots in the week
  const slotIds = slots.map(s => s.Slot_ID);

  const attendanceRecords = await prisma.classAttendance.findMany({
    where: {
      Slot_ID: { in: slotIds },
      PersonType: { in: [PERSON_TYPES.STUDENT, PERSON_TYPES.TEACHER] },
      Date: {
        gte: startDate,
        lte: weekEnd,
      },
    },
  });

  // Build counts per slot per day
  const countMap = {}; // "slotId_date" → { present, absent, late }
  const teacherMap = {}; // "slotId_date" → teacher attendance record
  for (const rec of attendanceRecords) {
    const dateKey = rec.Date.toISOString().split('T')[0];
    const key = `${rec.Slot_ID}_${dateKey}`;
    if (rec.PersonType === PERSON_TYPES.STUDENT) {
      if (!countMap[key]) countMap[key] = { present: 0, absent: 0, late: 0 };
      if (rec.Status === 'PRESENT') countMap[key].present++;
      else if (rec.Status === 'ABSENT') countMap[key].absent++;
      else if (rec.Status === 'LATE') countMap[key].late++;
    } else if (rec.PersonType === PERSON_TYPES.TEACHER) {
      teacherMap[key] = {
        status: rec.Status,
        firstSeenAt: rec.FirstSeenAt,
        lastSeenAt: rec.LastSeenAt,
        totalMinutes: rec.TotalMinutes,
        detectionsCount: rec.DetectionsCount,
      };
    }
  }

  // Build heatmap grid
  const grid = {};
  for (const day of DAYS) {
    const dateStr = weekDates[day];
    const daySlots = slots.filter(s => s.DayOfWeek === day);

    grid[day] = {
      date: dateStr,
      cells: daySlots.map(slot => {
        const key = `${slot.Slot_ID}_${dateStr}`;
        const counts = countMap[key] || { present: 0, absent: 0, late: 0 };
        const attended = counts.present + counts.late;

        return {
          slot: {
            Slot_ID: slot.Slot_ID,
            SubjectName: slot.SubjectName,
            StartTime: slot.StartTime,
            EndTime: slot.EndTime,
            course: slot.course,
            teacher: slot.teacher,
            Teacher_ID: slot.Teacher_ID,
            zone: slot.zone,
          },
          attendance: {
            present: counts.present,
            absent: counts.absent,
            late: counts.late,
            totalEnrolled: enrolledCount,
            attended,
            attendanceRate: enrolledCount > 0
              ? Math.round((attended / enrolledCount) * 100)
              : 0,
            // Intensity for heatmap: 0-1 scale
            intensity: enrolledCount > 0 ? attended / enrolledCount : 0,
          },
          teacherAttendance: teacherMap[key] || null,
        };
      }),
    };
  }

  // Build per-student attendance list
  const studentAttendanceList = enrollments.map(enrollment => {
    const student = enrollment.student;
    let totalSlots = 0;
    let present = 0;
    let absent = 0;
    let late = 0;

    // Build attendance per slot for this student
    const attendancePerSlot = {};
    for (const slot of slots) {
      for (const day of DAYS) {
        if (slot.DayOfWeek === day) {
          const dateStr = weekDates[day];
          const key = `${slot.Slot_ID}_${dateStr}`;
          
          // Find attendance record for this student at this slot
          const record = attendanceRecords.find(
            r => r.Student_ID === student.Student_ID && r.Slot_ID === slot.Slot_ID && r.Date.toISOString().split('T')[0] === dateStr
          );

          const status = record?.Status || 'NOT_PROCESSED';
          attendancePerSlot[key] = {
            slotId: slot.Slot_ID,
            subject: slot.SubjectName,
            startTime: slot.StartTime,
            endTime: slot.EndTime,
            status,
            firstSeenAt: record?.FirstSeenAt || null,
            totalMinutes: record?.TotalMinutes || 0,
          };

          totalSlots++;
          if (status === 'PRESENT') present++;
          else if (status === 'ABSENT') absent++;
          else if (status === 'LATE') late++;
        }
      }
    }

    return {
      student,
      summary: {
        totalSlots,
        present,
        absent,
        late,
        attendanceRate: (present + absent + late) > 0 ? Math.round(((present + late) / (present + absent + late)) * 100) : 100,
      },
      attendancePerSlot,
    };
  });

  successResponse(res, {
    section,
    weekStart,
    enrolledCount,
    grid,
    students: studentAttendanceList,
  }, 'Section weekly heatmap retrieved');
});

/**
 * @route   GET /api/class-attendance/teacher/:teacherId/weekly
 * @desc    Teacher's weekly view — which classes they attended
 * @query   weekStart=YYYY-MM-DD
 */
export const getTeacherWeeklyView = asyncHandler(async (req, res) => {
  const teacherId = parseInt(req.params.teacherId);
  const { weekStart, autoAggregate } = req.query;

  const teacher = await prisma.teacher.findUnique({
    where: { Teacher_ID: teacherId },
    select: { Teacher_ID: true, Name: true, Email: true, Department: true },
  });

  if (!teacher) {
    throw new NotFoundError(`Teacher with ID ${teacherId} not found`);
  }

  if (String(autoAggregate) !== 'false') {
    try {
      const today = new Date().toISOString().split('T')[0];
      await aggregateAttendance(today, null, null); 
    } catch (e) {
      console.error('[AUTO-AGGREGATE ERROR]', e.message);
    }
  }

  // Get teacher's slots
  const slots = await prisma.timetableSlot.findMany({
    where: { Teacher_ID: teacherId, IsActive: true },
    include: {
      section: { select: { Name: true } },
      course: { select: { Name: true, Code: true } },
      zone: { select: { Zone_Name: true } },
    },
    orderBy: [{ DayOfWeek: 'asc' }, { StartTime: 'asc' }],
  });

  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const startDate = new Date(weekStart);
  const weekEnd = new Date(startDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekDates = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    weekDates[DAYS[i]] = d.toISOString().split('T')[0];
  }

  const attendanceRecords = await prisma.classAttendance.findMany({
    where: {
      Teacher_ID: teacherId,
      PersonType: PERSON_TYPES.TEACHER,
      Date: { gte: startDate, lte: weekEnd },
    },
  });

  const attendanceLookup = {};
  for (const rec of attendanceRecords) {
    const dateKey = rec.Date.toISOString().split('T')[0];
    attendanceLookup[`${rec.Slot_ID}_${dateKey}`] = rec;
  }

  const grid = {};
  for (const day of DAYS) {
    const dateStr = weekDates[day];
    const daySlots = slots.filter(s => s.DayOfWeek === day);

    grid[day] = {
      date: dateStr,
      slots: daySlots.map(slot => {
        const key = `${slot.Slot_ID}_${dateStr}`;
        const attendance = attendanceLookup[key];
        return {
          slot: {
            Slot_ID: slot.Slot_ID,
            SubjectName: slot.SubjectName,
            StartTime: slot.StartTime,
            EndTime: slot.EndTime,
            section: slot.section,
            course: slot.course,
            zone: slot.zone,
          },
          attendance: attendance
            ? {
                status: attendance.Status,
                firstSeenAt: attendance.FirstSeenAt,
                lastSeenAt: attendance.LastSeenAt,
                totalMinutes: attendance.TotalMinutes,
                detectionsCount: attendance.DetectionsCount,
              }
            : { status: 'NOT_PROCESSED' },
        };
      }),
    };
  }

  successResponse(res, { teacher, weekStart, grid }, 'Teacher weekly view retrieved');
});
