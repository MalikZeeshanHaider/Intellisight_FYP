import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enroll face embeddings for a student or teacher
 * POST /api/face-recognition/enroll
 */
export const enrollPerson = async (req, res) => {
  try {
    const { personType, personId } = req.body;

    if (!personType || !personId) {
      return res.status(400).json({
        success: false,
        message: 'personType and personId are required'
      });
    }

    if (!['Student', 'Teacher'].includes(personType)) {
      return res.status(400).json({
        success: false,
        message: 'personType must be Student or Teacher'
      });
    }

    // Verify person exists
    const table = personType === 'Teacher' ? prisma.teacher : prisma.students;
    const idField = personType === 'Teacher' ? 'Teacher_ID' : 'Student_ID';
    
    const person = await table.findUnique({
      where: { [idField]: parseInt(personId) }
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: `${personType} with ID ${personId} not found`
      });
    }

    // Run Python enrollment script
    const scriptPath = path.join(__dirname, '../../face-recognition/enrollment.py');
    const python = spawn('python', [
      scriptPath,
      '--type', personType.toLowerCase(),
      '--id', personId.toString()
    ]);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[ENROLLMENT] ${data.toString().trim()}`);
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[ENROLLMENT ERROR] ${data.toString().trim()}`);
    });

    python.on('close', async (code) => {
      if (code === 0) {
        // Refresh person data to verify embeddings were saved
        const updatedPerson = await table.findUnique({
          where: { [idField]: parseInt(personId) },
          select: {
            [idField]: true,
            Name: true,
            Face_Embeddings: true
          }
        });

        res.json({
          success: true,
          message: `${person.Name} enrolled successfully`,
          data: {
            personType,
            personId: parseInt(personId),
            name: person.Name,
            hasEmbeddings: updatedPerson?.Face_Embeddings !== null
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Enrollment failed',
          error: errorOutput || output
        });
      }
    });

  } catch (error) {
    console.error('[ERROR] enrollPerson:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll person',
      error: error.message
    });
  }
};

/**
 * Enroll all students and teachers
 * POST /api/face-recognition/enroll-all
 */
export const enrollAll = async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../../face-recognition/enrollment.py');
    const python = spawn('python', [scriptPath, '--all']);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[ENROLLMENT ALL] ${data.toString().trim()}`);
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[ENROLLMENT ALL ERROR] ${data.toString().trim()}`);
    });

    python.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: 'Batch enrollment completed',
          output
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Batch enrollment failed',
          error: errorOutput || output
        });
      }
    });

  } catch (error) {
    console.error('[ERROR] enrollAll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll all persons',
      error: error.message
    });
  }
};

/**
 * Get active presence for a zone
 * GET /api/face-recognition/active-presence/:zoneId
 */
export const getActivePresence = async (req, res) => {
  try {
    const { zoneId } = req.params;

    const activePersons = await prisma.activePresence.findMany({
      where: { Zone_id: parseInt(zoneId) },
      include: {
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Department: true,
            Gender: true
          }
        },
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Department: true,
            Gender: true,
            Faculty_Type: true
          }
        },
        zone: {
          select: {
            Zone_id: true,
            Zone_Name: true
          }
        }
      },
      orderBy: { EntryTime: 'desc' }
    });

    const formatted = activePersons.map(p => ({
      presenceId: p.Presence_ID,
      personType: p.PersonType,
      person: p.student || p.teacher,
      zone: p.zone,
      entryTime: p.EntryTime
    }));

    res.json({
      success: true,
      data: formatted,
      count: formatted.length
    });

  } catch (error) {
    console.error('[ERROR] getActivePresence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active presence',
      error: error.message
    });
  }
};

/**
 * Get all active presence across all zones
 * GET /api/face-recognition/active-presence
 */
export const getAllActivePresence = async (req, res) => {
  try {
    const activePersons = await prisma.activePresence.findMany({
      include: {
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Department: true,
            Gender: true
          }
        },
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Department: true,
            Gender: true,
            Faculty_Type: true
          }
        },
        zone: {
          select: {
            Zone_id: true,
            Zone_Name: true
          }
        }
      },
      orderBy: { EntryTime: 'desc' }
    });

    const formatted = activePersons.map(p => ({
      presenceId: p.Presence_ID,
      personType: p.PersonType,
      person: p.student || p.teacher,
      zone: p.zone,
      entryTime: p.EntryTime
    }));

    res.json({
      success: true,
      data: formatted,
      count: formatted.length
    });

  } catch (error) {
    console.error('[ERROR] getAllActivePresence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active presence',
      error: error.message
    });
  }
};

/**
 * Get attendance logs with filters
 * GET /api/face-recognition/attendance-log
 */
export const getAttendanceLogs = async (req, res) => {
  try {
    const { zoneId, personType, personId, startDate, endDate, limit = 100, offset = 0 } = req.query;

    const where = {};
    
    if (zoneId) where.Zone_id = parseInt(zoneId);
    if (personType) where.PersonType = personType;
    if (personId) {
      if (personType === 'Student') {
        where.Student_ID = parseInt(personId);
      } else if (personType === 'Teacher') {
        where.Teacher_ID = parseInt(personId);
      }
    }
    if (startDate || endDate) {
      where.EntryTime = {};
      if (startDate) where.EntryTime.gte = new Date(startDate);
      if (endDate) where.EntryTime.lte = new Date(endDate);
    }

    const [logs, totalCount] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          student: {
            select: {
              Student_ID: true,
              Name: true,
              Department: true
            }
          },
          teacher: {
            select: {
              Teacher_ID: true,
              Name: true,
              Department: true,
              Faculty_Type: true
            }
          },
          zone: {
            select: {
              Zone_id: true,
              Zone_Name: true
            }
          }
        },
        orderBy: { EntryTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.attendanceLog.count({ where })
    ]);

    const formatted = logs.map(log => ({
      logId: log.Log_ID,
      personType: log.PersonType,
      person: log.student || log.teacher,
      zone: log.zone,
      entryTime: log.EntryTime,
      exitTime: log.ExitTime,
      duration: log.Duration
    }));

    res.json({
      success: true,
      data: formatted,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + formatted.length < totalCount
      }
    });

  } catch (error) {
    console.error('[ERROR] getAttendanceLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance logs',
      error: error.message
    });
  }
};

/**
 * Start face recognition for a zone
 * POST /api/face-recognition/start/:zoneId
 */
export const startRecognition = async (req, res) => {
  try {
    const { zoneId } = req.params;

    // Verify zone exists and has cameras
    const zone = await prisma.zone.findUnique({
      where: { Zone_id: parseInt(zoneId) },
      include: {
        Camara: true
      }
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: `Zone ${zoneId} not found`
      });
    }

    if (!zone.Camara || zone.Camara.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No cameras configured for zone ${zone.Zone_Name}`
      });
    }

    // Start recognition process (non-blocking)
    const scriptPath = path.join(__dirname, '../../face-recognition/recognition.py');
    const python = spawn('python', [scriptPath, '--zone', zoneId.toString()], {
      detached: true,
      stdio: 'ignore'
    });

    python.unref();

    res.json({
      success: true,
      message: `Face recognition started for ${zone.Zone_Name}`,
      data: {
        zoneId: parseInt(zoneId),
        zoneName: zone.Zone_Name,
        cameras: zone.Camara.length,
        processId: python.pid
      }
    });

  } catch (error) {
    console.error('[ERROR] startRecognition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start recognition',
      error: error.message
    });
  }
};

export default {
  enrollPerson,
  enrollAll,
  getActivePresence,
  getAllActivePresence,
  getAttendanceLogs,
  startRecognition
};
