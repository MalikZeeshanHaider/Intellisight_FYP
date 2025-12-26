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

  /**
   * Get daily detection statistics for the last 7 days
   * Returns count of unique persons detected each day
   */
  async getDailyDetectionStats(days = 7) {
    // Calculate dates for the last N days including today
    const now = new Date(); // Current time
    
    // Get today's date at midnight in local timezone
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    console.log('=== DATE CALCULATION DEBUG ===');
    console.log('Current time (now):', now.toISOString());
    console.log('Current local date:', now.toLocaleDateString());
    console.log('Today (midnight local):', today.toISOString());
    console.log('Today date:', today.getDate(), 'Month:', today.getMonth() + 1, 'Year:', today.getFullYear());
    
    // Calculate start date (N-1 days ago from today)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    
    // End date is end of today (23:59:59.999)
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    console.log('Start date:', startDate.toISOString(), '(Day:', startDate.getDate(), ')');
    console.log('End date:', endDate.toISOString(), '(Day:', endDate.getDate(), ')');
    console.log('Fetching daily stats from:', startDate.toISOString(), 'to:', endDate.toISOString());

    // Get all attendance logs for the last N days
    const attendanceLogs = await prisma.attendanceLog.findMany({
      where: {
        EntryTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        EntryTime: true,
        PersonType: true,
        Student_ID: true,
        Teacher_ID: true,
      },
      orderBy: {
        EntryTime: 'asc',
      },
    });

    console.log('Found attendance logs:', attendanceLogs.length);

    // Initialize stats for each day in the range
    const dailyStats = [];
    const dailyStatsMap = {};

    // Create entries for all days in range (including today)
    // Use local date for comparison
    const todayDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    console.log('Today date key for comparison:', todayDateKey);
    
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Create date key from local date components to avoid timezone issues
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      
      dailyStatsMap[dateKey] = {
        day: currentDate.getDate(),
        date: dateKey,
        dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        students: new Set(),
        teachers: new Set(),
        isToday: dateKey === todayDateKey,
      };
    }

    console.log('Initialized days:', Object.keys(dailyStatsMap));
    console.log('Number of attendance logs to process:', attendanceLogs.length);

    // Process attendance logs
    attendanceLogs.forEach((log, index) => {
      const logDate = new Date(log.EntryTime);
      // Use local date components to create date key
      const dateKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
      
      // Normalize PersonType to uppercase for comparison (handles both 'Student' and 'STUDENT')
      const normalizedPersonType = log.PersonType?.toUpperCase();
      
      console.log(`Log #${index + 1}: dateKey=${dateKey}, PersonType=${log.PersonType}, EntryTime=${log.EntryTime}, Student_ID=${log.Student_ID}, Teacher_ID=${log.Teacher_ID}, Found in map: ${!!dailyStatsMap[dateKey]}`);
      
      if (dailyStatsMap[dateKey]) {
        if (normalizedPersonType === PERSON_TYPES.STUDENT && log.Student_ID) {
          dailyStatsMap[dateKey].students.add(log.Student_ID);
          console.log(`  -> Added student ${log.Student_ID} to ${dateKey}`);
        } else if (normalizedPersonType === PERSON_TYPES.TEACHER && log.Teacher_ID) {
          dailyStatsMap[dateKey].teachers.add(log.Teacher_ID);
          console.log(`  -> Added teacher ${log.Teacher_ID} to ${dateKey}`);
        }
      } else {
        console.log(`  -> WARNING: Date ${dateKey} not found in dailyStatsMap!`);
      }
    });

    // Convert to array and calculate totals
    const result = Object.values(dailyStatsMap).map((stat) => {
      console.log(`Final stats for ${stat.date}: students=${stat.students.size}, teachers=${stat.teachers.size}, total=${stat.students.size + stat.teachers.size}`);
      return {
        day: stat.day,
        date: stat.date,
        dayOfWeek: stat.dayOfWeek,
        totalDetections: stat.students.size + stat.teachers.size,
        studentDetections: stat.students.size,
        teacherDetections: stat.teachers.size,
        isToday: stat.isToday,
      };
    });

    // Sort by date
    result.sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalDetections = result.reduce((sum, day) => sum + day.totalDetections, 0);

    console.log('Daily stats result:', JSON.stringify(result, null, 2));
    console.log('Total detections across all days:', totalDetections);

    return {
      days: days,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      currentTime: endDate.toISOString(),
      dailyStats: result,
      summary: {
        totalDays: days,
        totalDetections: totalDetections,
        averagePerDay: (totalDetections / days).toFixed(2),
      },
    };
  }
}

export default new TimetableService();
