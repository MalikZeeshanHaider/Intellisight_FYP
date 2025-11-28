import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store active recognition processes
const activeProcesses = new Map();

/**
 * Start automatic live recognition for a zone
 * POST /api/live-recognition/start/:zoneId
 */
export const startLiveRecognition = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const zoneIdInt = parseInt(zoneId);

    // Check if already running
    if (activeProcesses.has(zoneIdInt)) {
      return res.status(400).json({
        success: false,
        message: `Recognition already running for zone ${zoneId}`
      });
    }

    // Verify zone exists and has cameras
    const zone = await prisma.zone.findUnique({
      where: { Zone_id: zoneIdInt },
      include: {
        Camara: {
          where: {
            Camera_Type: {
              in: ['Entry', 'Exit']
            }
          }
        }
      }
    });

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: `Zone ${zoneId} not found`
      });
    }

    const entryCameras = zone.Camara.filter(c => c.Camera_Type === 'Entry');
    const exitCameras = zone.Camara.filter(c => c.Camera_Type === 'Exit');

    if (entryCameras.length === 0 && exitCameras.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No entry/exit cameras configured for ${zone.Zone_Name}`
      });
    }

    // Start recognition process
    const scriptPath = path.join(__dirname, '../../face-recognition/recognition.py');
    const python = spawn('python', [scriptPath, '--zone', zoneId.toString()], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Store process reference
    activeProcesses.set(zoneIdInt, {
      process: python,
      zoneId: zoneIdInt,
      zoneName: zone.Zone_Name,
      startTime: new Date(),
      pid: python.pid
    });

    // Log output
    python.stdout.on('data', (data) => {
      console.log(`[ZONE ${zoneId}] ${data.toString().trim()}`);
    });

    python.stderr.on('data', (data) => {
      console.error(`[ZONE ${zoneId} ERROR] ${data.toString().trim()}`);
    });

    python.on('close', (code) => {
      console.log(`[ZONE ${zoneId}] Recognition process ended with code ${code}`);
      activeProcesses.delete(zoneIdInt);
    });

    res.json({
      success: true,
      message: `Live recognition started for ${zone.Zone_Name}`,
      data: {
        zoneId: zoneIdInt,
        zoneName: zone.Zone_Name,
        pid: python.pid,
        entryCameras: entryCameras.length,
        exitCameras: exitCameras.length,
        startTime: new Date()
      }
    });

  } catch (error) {
    console.error('[ERROR] startLiveRecognition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start live recognition',
      error: error.message
    });
  }
};

/**
 * Stop live recognition for a zone
 * POST /api/live-recognition/stop/:zoneId
 */
export const stopLiveRecognition = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const zoneIdInt = parseInt(zoneId);

    const processInfo = activeProcesses.get(zoneIdInt);

    if (!processInfo) {
      return res.status(404).json({
        success: false,
        message: `No active recognition process for zone ${zoneId}`
      });
    }

    // Kill the process
    processInfo.process.kill('SIGTERM');
    activeProcesses.delete(zoneIdInt);

    res.json({
      success: true,
      message: `Live recognition stopped for zone ${zoneId}`,
      data: {
        zoneId: zoneIdInt,
        zoneName: processInfo.zoneName,
        runtime: Math.floor((new Date() - processInfo.startTime) / 1000) + ' seconds'
      }
    });

  } catch (error) {
    console.error('[ERROR] stopLiveRecognition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop live recognition',
      error: error.message
    });
  }
};

/**
 * Get status of all active recognition processes
 * GET /api/live-recognition/status
 */
export const getRecognitionStatus = async (req, res) => {
  try {
    const statuses = [];

    for (const [zoneId, processInfo] of activeProcesses.entries()) {
      statuses.push({
        zoneId,
        zoneName: processInfo.zoneName,
        pid: processInfo.pid,
        startTime: processInfo.startTime,
        uptime: Math.floor((new Date() - processInfo.startTime) / 1000) + ' seconds',
        status: 'running'
      });
    }

    res.json({
      success: true,
      data: statuses,
      count: statuses.length
    });

  } catch (error) {
    console.error('[ERROR] getRecognitionStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recognition status',
      error: error.message
    });
  }
};

/**
 * Get recent detection logs (all persons including unknown)
 * GET /api/live-recognition/logs
 */
export const getDetectionLogs = async (req, res) => {
  try {
    const { zoneId, limit = 50, offset = 0 } = req.query;

    // Get attendance logs (known persons)
    const where = zoneId ? { Zone_id: parseInt(zoneId) } : {};
    
    const [attendanceLogs, unknownFaces] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          student: {
            select: { Student_ID: true, Name: true, Department: true, Gender: true }
          },
          teacher: {
            select: { Teacher_ID: true, Name: true, Department: true, Gender: true, Faculty_Type: true }
          },
          zone: {
            select: { Zone_id: true, Zone_Name: true }
          }
        },
        orderBy: { CreatedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.unknownFaces.findMany({
        where: zoneId ? { Zone_id: parseInt(zoneId) } : {},
        include: {
          zone: {
            select: { Zone_id: true, Zone_Name: true }
          }
        },
        orderBy: { DetectedTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      })
    ]);

    // Format known persons logs
    const knownLogs = attendanceLogs.map(log => ({
      type: 'known',
      logId: log.Log_ID,
      personType: log.PersonType,
      personId: log.PersonType === 'Student' ? log.Student_ID : log.Teacher_ID,
      person: log.student || log.teacher,
      zone: log.zone,
      entryTime: log.EntryTime,
      exitTime: log.ExitTime,
      duration: log.Duration,
      timestamp: log.CreatedAt
    }));

    // Format unknown persons logs
    const unknownLogs = unknownFaces.map(unknown => ({
      type: 'unknown',
      logId: unknown.Unknown_ID,
      personType: 'Unknown',
      personId: null,
      person: {
        Name: 'Unknown Person',
        imagePath: unknown.Image_Path
      },
      zone: unknown.zone,
      detectedTime: unknown.DetectedTime,
      status: unknown.Status,
      timestamp: unknown.DetectedTime
    }));

    // Combine and sort by timestamp
    const allLogs = [...knownLogs, ...unknownLogs].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json({
      success: true,
      data: allLogs.slice(0, parseInt(limit)),
      counts: {
        known: knownLogs.length,
        unknown: unknownLogs.length,
        total: allLogs.length
      }
    });

  } catch (error) {
    console.error('[ERROR] getDetectionLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get detection logs',
      error: error.message
    });
  }
};

/**
 * Get active presence (people currently in zones)
 * GET /api/live-recognition/active
 */
export const getLiveActivePresence = async (req, res) => {
  try {
    const { zoneId } = req.query;

    const where = zoneId ? { Zone_id: parseInt(zoneId) } : {};

    const activePersons = await prisma.activePresence.findMany({
      where,
      include: {
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Department: true,
            Gender: true,
            RollNumber: true
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

    const formatted = activePersons.map(p => {
      const duration = Math.floor((new Date() - new Date(p.EntryTime)) / 60000); // minutes
      return {
        presenceId: p.Presence_ID,
        personType: p.PersonType,
        personId: p.PersonType === 'Student' ? p.Student_ID : p.Teacher_ID,
        person: p.student || p.teacher,
        zone: p.zone,
        entryTime: p.EntryTime,
        duration: duration + ' min',
        status: 'active'
      };
    });

    res.json({
      success: true,
      data: formatted,
      count: formatted.length
    });

  } catch (error) {
    console.error('[ERROR] getLiveActivePresence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active presence',
      error: error.message
    });
  }
};

export default {
  startLiveRecognition,
  stopLiveRecognition,
  getRecognitionStatus,
  getDetectionLogs,
  getLiveActivePresence
};
