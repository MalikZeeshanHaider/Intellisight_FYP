import { prisma } from '../config/database.js';
import { PERSON_TYPES } from '../config/constants.js';

/**
 * Attendance Aggregation Service
 * 
 * Converts raw camera detection logs (AttendanceLog) into structured
 * ClassAttendance records by cross-referencing TimetableSlot windows.
 * 
 * Constants:
 *   GRACE_BEFORE  – minutes before class start to count as "in class"
 *   GRACE_AFTER   – minutes after class end to still count
 *   MIN_MINUTES   – minimum minutes detected to mark PRESENT
 *   LATE_THRESHOLD – minutes after StartTime to mark LATE instead of PRESENT
 */

const GRACE_BEFORE = 10;   // 10 min before class
const GRACE_AFTER = 10;    // 10 min after class
const MIN_MINUTES = 5;     // at least 5 min to count as present
const LATE_THRESHOLD = 15; // 15 min late threshold

/**
 * Parse "HH:mm" string into { hours, minutes }
 */
function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Build an absolute Date for a given date + "HH:mm" time string
 */
function buildDateTime(dateStr, timeStr, offsetMinutes = 0) {
  const date = new Date(dateStr);
  const { hours, minutes } = parseTime(timeStr);
  date.setHours(hours, minutes + offsetMinutes, 0, 0);
  return date;
}

/**
 * Calculate overlap minutes between two time ranges
 * [entryTime, exitTime] ∩ [windowStart, windowEnd]
 */
function overlapMinutes(entryTime, exitTime, windowStart, windowEnd) {
  const start = Math.max(entryTime.getTime(), windowStart.getTime());
  const end = Math.min(
    (exitTime || new Date()).getTime(),
    windowEnd.getTime()
  );
  if (start >= end) return 0;
  return Math.floor((end - start) / 1000 / 60);
}

/**
 * Map DayOfWeek string to JS getDay() number
 */
function dayOfWeekToNumber(day) {
  const map = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  return map[day.toUpperCase()] ?? -1;
}

/**
 * Get the day name from a Date
 */
function getDayName(date) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[date.getDay()];
}

/**
 * Aggregate attendance for a specific date
 * Processes all active timetable slots and cross-references with camera logs
 * 
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number|null} sectionId - Optional: only process this section
 * @param {number|null} slotId - Optional: only process this slot
 * @returns {object} Summary of aggregation results
 */
export async function aggregateAttendance(dateStr, sectionId = null, slotId = null) {
  const targetDate = new Date(dateStr);
  const dayName = getDayName(targetDate);

  // Build slot filter
  const slotWhere = {
    IsActive: true,
    DayOfWeek: dayName,
  };
  if (sectionId) slotWhere.Section_ID = sectionId;
  if (slotId) slotWhere.Slot_ID = slotId;

  // Fetch matching slots
  const slots = await prisma.timetableSlot.findMany({
    where: slotWhere,
    include: {
      section: {
        include: {
          Enrollments: {
            include: {
              student: { select: { Student_ID: true, Name: true } },
            },
          },
        },
      },
      teacher: { select: { Teacher_ID: true, Name: true } },
      zone: { select: { Zone_id: true, Zone_Name: true } },
    },
  });

  if (slots.length === 0) {
    return {
      date: dateStr,
      day: dayName,
      slotsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      message: `No active timetable slots found for ${dayName} (${dateStr})`,
    };
  }

  let recordsCreated = 0;
  let recordsUpdated = 0;

  for (const slot of slots) {
    // Calculate the detection window
    const windowStart = buildDateTime(dateStr, slot.StartTime, -GRACE_BEFORE);
    const windowEnd = buildDateTime(dateStr, slot.EndTime, GRACE_AFTER);
    const classStart = buildDateTime(dateStr, slot.StartTime);
    
    // Skip future slots that haven't even started their grace period yet
    if (windowStart > new Date() && dateStr === new Date().toISOString().split('T')[0]) {
      continue;
    }

    // Ignore any logs older than 12 hours before class start to prevent ghost presences
    const maxLogAge = new Date(windowStart.getTime() - 12 * 60 * 60 * 1000);

    // ──── Process enrolled STUDENTS ────
    const enrolledStudents = slot.section.Enrollments.map(e => e.student);

    for (const student of enrolledStudents) {
      // Find all camera logs for this student in this zone during the window
      const logs = await prisma.attendanceLog.findMany({
        where: {
          Student_ID: student.Student_ID,
          Zone_id: slot.Zone_id || undefined,
          PersonType: PERSON_TYPES.STUDENT,
          EntryTime: { lte: windowEnd, gte: maxLogAge },
          OR: [
            { ExitTime: { gte: windowStart } },
            { ExitTime: null },  // still in zone
          ],
        },
        orderBy: { EntryTime: 'asc' },
      });

      // Also grab currently active presences (entry without exit yet)
      const activePresenceLogs = await prisma.activePresence.findMany({
        where: {
          Student_ID: student.Student_ID,
          Zone_id: slot.Zone_id || undefined,
          PersonType: PERSON_TYPES.STUDENT,
          EntryTime: { lte: windowEnd, gte: maxLogAge }
        }
      });
      
        const combinedLogs = [...logs, ...activePresenceLogs.map(ap => ({
          EntryTime: ap.EntryTime,
          ExitTime: null
        }))];
        
        combinedLogs.sort((a, b) => a.EntryTime - b.EntryTime);
        
      // Calculate total overlap time and detection metadata
      let totalMinutes = 0;
      let firstSeen = null;
      let lastSeen = null;
      let detections = combinedLogs.length;

      for (const log of combinedLogs) {
        const overlap = overlapMinutes(log.EntryTime, log.ExitTime, windowStart, windowEnd);
        totalMinutes += overlap;

        if (!firstSeen || log.EntryTime < firstSeen) {
          firstSeen = log.EntryTime;
        }
        const exitOrNow = log.ExitTime || new Date();
        if (!lastSeen || exitOrNow > lastSeen) {
          lastSeen = exitOrNow;
        }
      }

      // Determine status
      let status = 'ABSENT';
      const isActiveNow = combinedLogs.some(l => !l.ExitTime);
      
      if (totalMinutes >= MIN_MINUTES || isActiveNow) {
        // Check if late: first seen after class start + threshold
        if (firstSeen && firstSeen > new Date(classStart.getTime() + LATE_THRESHOLD * 60000)) {
          status = 'LATE';
        } else {
          status = 'PRESENT';
        }
      }

      // Upsert ClassAttendance record
      const attendanceData = {
        Slot_ID: slot.Slot_ID,
        Date: targetDate,
        PersonType: PERSON_TYPES.STUDENT,
        Student_ID: student.Student_ID,
        Teacher_ID: null,
        Status: status,
        FirstSeenAt: firstSeen,
        LastSeenAt: lastSeen,
        TotalMinutes: totalMinutes,
        DetectionsCount: detections,
      };

      const existing = await prisma.classAttendance.findUnique({
        where: {
          Slot_ID_Date_Student_ID: {
            Slot_ID: slot.Slot_ID,
            Date: targetDate,
            Student_ID: student.Student_ID,
          },
        },
      });

      if (existing) {
        await prisma.classAttendance.update({
          where: { Attendance_ID: existing.Attendance_ID },
          data: attendanceData,
        });
        recordsUpdated++;
      } else {
        await prisma.classAttendance.create({
          data: attendanceData,
        });
        recordsCreated++;
      }
    }

    // ──── Process TEACHER for this slot ────
    if (slot.Teacher_ID) {
      const teacherLogs = await prisma.attendanceLog.findMany({
        where: {
          Teacher_ID: slot.Teacher_ID,
          Zone_id: slot.Zone_id || undefined,
          PersonType: PERSON_TYPES.TEACHER,
          EntryTime: { lte: windowEnd, gte: maxLogAge },
          OR: [
            { ExitTime: { gte: windowStart } },
            { ExitTime: null },
          ],
        },
        orderBy: { EntryTime: 'asc' },
      });

      const activeTeacherLogs = await prisma.activePresence.findMany({
        where: {
          Teacher_ID: slot.Teacher_ID,
          Zone_id: slot.Zone_id || undefined,
          PersonType: PERSON_TYPES.TEACHER,
          EntryTime: { lte: windowEnd, gte: maxLogAge }
        }
      });

      const combinedTeacherLogs = [...teacherLogs, ...activeTeacherLogs.map(ap => ({
        EntryTime: ap.EntryTime,
        ExitTime: null 
      }))];

      combinedTeacherLogs.sort((a, b) => a.EntryTime - b.EntryTime);

      let totalMinutes = 0;
      let firstSeen = null;
      let lastSeen = null;
      let detections = combinedTeacherLogs.length;

      for (const log of combinedTeacherLogs) {
        const overlap = overlapMinutes(log.EntryTime, log.ExitTime, windowStart, windowEnd);
        totalMinutes += overlap;

        if (!firstSeen || log.EntryTime < firstSeen) firstSeen = log.EntryTime;
        const exitOrNow = log.ExitTime || new Date();
        if (!lastSeen || exitOrNow > lastSeen) lastSeen = exitOrNow;
      }

      let status = 'ABSENT';
      const isActiveNow = combinedTeacherLogs.some(l => !l.ExitTime);
      if (totalMinutes >= MIN_MINUTES || isActiveNow) {
        if (firstSeen && firstSeen > new Date(classStart.getTime() + LATE_THRESHOLD * 60000)) {
          status = 'LATE';
        } else {
          status = 'PRESENT';
        }
      }

      const teacherAttendanceData = {
        Slot_ID: slot.Slot_ID,
        Date: targetDate,
        PersonType: PERSON_TYPES.TEACHER,
        Student_ID: null,
        Teacher_ID: slot.Teacher_ID,
        Status: status,
        FirstSeenAt: firstSeen,
        LastSeenAt: lastSeen,
        TotalMinutes: totalMinutes,
        DetectionsCount: detections,
      };

      const existingTeacher = await prisma.classAttendance.findUnique({
        where: {
          Slot_ID_Date_Teacher_ID: {
            Slot_ID: slot.Slot_ID,
            Date: targetDate,
            Teacher_ID: slot.Teacher_ID,
          },
        },
      });

      if (existingTeacher) {
        await prisma.classAttendance.update({
          where: { Attendance_ID: existingTeacher.Attendance_ID },
          data: teacherAttendanceData,
        });
        recordsUpdated++;
      } else {
        await prisma.classAttendance.create({
          data: teacherAttendanceData,
        });
        recordsCreated++;
      }
    }
  }

  return {
    date: dateStr,
    day: dayName,
    slotsProcessed: slots.length,
    recordsCreated,
    recordsUpdated,
    totalRecords: recordsCreated + recordsUpdated,
  };
}

/**
 * Aggregate attendance for a date range (e.g., a full week)
 */
export async function aggregateWeek(startDateStr, endDateStr, sectionId = null) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const results = [];

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const result = await aggregateAttendance(dateStr, sectionId);
    results.push(result);
    current.setDate(current.getDate() + 1);
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    daysProcessed: results.length,
    totalRecordsCreated: results.reduce((sum, r) => sum + r.recordsCreated, 0),
    totalRecordsUpdated: results.reduce((sum, r) => sum + r.recordsUpdated, 0),
    dailyResults: results,
  };
}
