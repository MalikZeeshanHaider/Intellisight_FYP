import { prisma } from '../config/database.js';
import { PERSON_TYPES } from '../config/constants.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

/**
 * Business logic for entry/exit tracking
 * 
 * Algorithm:
 * 1. Entry: Check for existing open entry (no ExitTime), prevent duplicate
 * 2. Exit: Find most recent open entry, update ExitTime
 * 3. Edge case: Exit without entry logs anomaly but still records
 */

export class TimetableService {
  /**
   * Record entry event
   * Prevents duplicate open entries for the same person
   */
  async recordEntry({ personType, personId, zoneId, cameraId, timestamp, adminId }) {
    const entryTime = timestamp ? new Date(timestamp) : new Date();

    // Check for existing open entry
    const existingOpenEntry = await this.findOpenEntry(personType, personId);

    if (existingOpenEntry) {
      throw new ConflictError(
        `${personType} #${personId} already has an active entry at Zone #${existingOpenEntry.Zone_id}. ` +
        `Please record exit first or the entry was at ${existingOpenEntry.EntryTime.toISOString()}`
      );
    }

    // Verify person exists
    await this.verifyPersonExists(personType, personId);

    // Verify zone exists
    if (zoneId) {
      await this.verifyZoneExists(zoneId);
    }

    // Create entry record
    const data = {
      EntryTime: entryTime,
      ExitTime: null,
      PersonType: personType,
      Zone_id: zoneId,
      Admin_ID: adminId,
    };

    if (personType === PERSON_TYPES.TEACHER) {
      data.Teacher_ID = personId;
    } else {
      data.Student_ID = personId;
    }

    // Create attendance log entry
    const attendanceEntry = await prisma.attendanceLog.create({
      data: {
        EntryTime: entryTime,
        PersonType: personType,
        Zone_id: zoneId,
        Teacher_ID: personType === PERSON_TYPES.TEACHER ? personId : null,
        Student_ID: personType === PERSON_TYPES.STUDENT ? personId : null,
      },
      include: {
        zone: true,
        teacher: personType === PERSON_TYPES.TEACHER ? { select: { Name: true, Email: true } } : false,
        student: personType === PERSON_TYPES.STUDENT ? { select: { Name: true, Email: true } } : false,
      },
    });

    // Also create active presence entry
    await prisma.activePresence.create({
      data: {
        PersonType: personType,
        Zone_id: zoneId,
        Teacher_ID: personType === PERSON_TYPES.TEACHER ? personId : null,
        Student_ID: personType === PERSON_TYPES.STUDENT ? personId : null,
        EntryTime: entryTime,
      },
    });

    return attendanceEntry;
  }

  /**
   * Record exit event
   * Finds most recent open entry and updates ExitTime
   * If no open entry found, creates exit-only record (logs anomaly)
   */
  async recordExit({ personType, personId, zoneId, timestamp, adminId }) {
    const exitTime = timestamp ? new Date(timestamp) : new Date();

    // Find most recent open entry in ActivePresence
    const openEntry = await this.findOpenEntry(personType, personId, zoneId);

    if (openEntry) {
      // Remove from ActivePresence
      await prisma.activePresence.delete({
        where: { Presence_ID: openEntry.Presence_ID },
      });

      // Update corresponding AttendanceLog entry
      const attendanceLog = await prisma.attendanceLog.findFirst({
        where: {
          PersonType: personType,
          Zone_id: zoneId,
          Teacher_ID: personType === PERSON_TYPES.TEACHER ? personId : null,
          Student_ID: personType === PERSON_TYPES.STUDENT ? personId : null,
          EntryTime: openEntry.EntryTime,
          ExitTime: null,
        },
        orderBy: { EntryTime: 'desc' },
      });

      if (attendanceLog) {
        const duration = Math.floor((exitTime - new Date(attendanceLog.EntryTime)) / 1000 / 60); // minutes
        
        const updated = await prisma.attendanceLog.update({
          where: { Log_ID: attendanceLog.Log_ID },
          data: { 
            ExitTime: exitTime,
            Duration: duration,
          },
          include: {
            zone: true,
            teacher: personType === PERSON_TYPES.TEACHER ? { select: { Name: true, Email: true } } : false,
            student: personType === PERSON_TYPES.STUDENT ? { select: { Name: true, Email: true } } : false,
          },
        });

        return updated;
      }
    }

    // No open entry found - create exit-only record (anomaly)
    const exitRecord = await prisma.attendanceLog.create({
      data: {
        EntryTime: exitTime, // Use exit time as entry since we don't have entry
        ExitTime: exitTime,
        PersonType: personType,
        Zone_id: zoneId,
        Teacher_ID: personType === PERSON_TYPES.TEACHER ? personId : null,
        Student_ID: personType === PERSON_TYPES.STUDENT ? personId : null,
        Duration: 0,
      },
      include: {
        zone: true,
        teacher: personType === PERSON_TYPES.TEACHER ? { select: { Name: true, Email: true } } : false,
        student: personType === PERSON_TYPES.STUDENT ? { select: { Name: true, Email: true } } : false,
      },
    });

    return exitRecord;
  }

  /**
   * Find open entry (no exit time) for a person
   */
  async findOpenEntry(personType, personId, zoneId = null) {
    const where = {
      PersonType: personType,
    };

    if (personType === PERSON_TYPES.TEACHER) {
      where.Teacher_ID = personId;
    } else {
      where.Student_ID = personId;
    }

    if (zoneId) {
      where.Zone_id = zoneId;
    }

    const openEntry = await prisma.activePresence.findFirst({
      where,
      orderBy: { EntryTime: 'desc' },
    });

    return openEntry;
  }

  /**
   * Get all currently active persons (those with open entries)
   */
  async getActivePersons() {
    const activeEntries = await prisma.activePresence.findMany({
      include: {
        zone: { select: { Zone_Name: true, Zone_id: true } },
        teacher: { select: { Teacher_ID: true, Name: true, Email: true } },
        student: { select: { Student_ID: true, Name: true, Email: true } },
      },
      orderBy: { EntryTime: 'desc' },
    });

    return activeEntries;
  }

  /**
   * Query timetable with filters
   */
  async queryTimetable(filters = {}) {
    const { zoneId, personType, personId, from, to, page = 1, limit = 50 } = filters;

    const where = {};

    if (zoneId) {
      where.Zone_id = zoneId;
    }

    if (personType) {
      where.PersonType = personType;

      if (personId) {
        if (personType === PERSON_TYPES.TEACHER) {
          where.Teacher_ID = personId;
        } else {
          where.Student_ID = personId;
        }
      }
    }

    // Date range filter
    if (from || to) {
      where.EntryTime = {};
      if (from) {
        where.EntryTime.gte = new Date(from);
      }
      if (to) {
        where.EntryTime.lte = new Date(to);
      }
    }

    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          zone: { select: { Zone_Name: true } },
          teacher: { select: { Name: true, Email: true } },
          student: { select: { Name: true, Email: true } },
        },
        orderBy: { EntryTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendanceLog.count({ where }),
    ]);

    return {
      entries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get analytics data
   */
  async getAnalytics() {
    const [
      totalEntriesToday,
      activeNow,
      entriesByZone,
      entriesByPersonType,
    ] = await Promise.all([
      // Total entries today
      prisma.attendanceLog.count({
        where: {
          EntryTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // Currently active
      prisma.activePresence.count(),

      // Entries by zone (today)
      prisma.attendanceLog.groupBy({
        by: ['Zone_id'],
        where: {
          EntryTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _count: true,
      }),

      // Entries by person type (today)
      prisma.attendanceLog.groupBy({
        by: ['PersonType'],
        where: {
          EntryTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _count: true,
      }),
    ]);

    return {
      totalEntriesToday,
      activeNow,
      entriesByZone,
      entriesByPersonType,
    };
  }

  /**
   * Get recent activity (last N entries/exits)
   */
  async getRecentActivity(limit = 10) {
    const recentEntries = await prisma.attendanceLog.findMany({
      take: limit,
      orderBy: [
        { EntryTime: 'desc' },
      ],
      include: {
        zone: {
          select: {
            Zone_id: true,
            Zone_Name: true,
          },
        },
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Email: true,
          },
        },
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Email: true,
          },
        },
      },
    });

    return recentEntries;
  }

  /**
   * Verify person exists
   */
  async verifyPersonExists(personType, personId) {
    let person;

    if (personType === PERSON_TYPES.TEACHER) {
      person = await prisma.teacher.findUnique({
        where: { Teacher_ID: personId },
      });
    } else {
      person = await prisma.students.findUnique({
        where: { Student_ID: personId },
      });
    }

    if (!person) {
      throw new NotFoundError(`${personType} with ID ${personId} not found`);
    }

    return person;
  }

  /**
   * Verify zone exists
   */
  async verifyZoneExists(zoneId) {
    const zone = await prisma.zone.findUnique({
      where: { Zone_id: zoneId },
    });

    if (!zone) {
      throw new NotFoundError(`Zone with ID ${zoneId} not found`);
    }

    return zone;
  }
}

export default new TimetableService();
