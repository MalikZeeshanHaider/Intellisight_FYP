/**
 * Zone 1 Live Tracking Controller
 * Handles real-time face recognition and tracking for Zone 1
 */

import { PrismaClient } from '@prisma/client';
import imagePreprocessingService from '../services/imagePreprocessing.service.js';

const prisma = new PrismaClient();

/**
 * Log recognized person entry to Zone 1 (via Entry camera)
 * POST /api/zones/1/recognize
 */
export const logRecognizedPerson = async (req, res) => {
  try {
    const { personId, personType, confidence, cameraType } = req.body;

    if (!personId || !personType) {
      return res.status(400).json({
        success: false,
        message: 'Person ID and Person Type are required'
      });
    }

    console.log(`📹 ${cameraType || 'Unknown'} camera detected: ${personType} ${personId}`);

    // Normalize personType (Student/Teacher)
    const normalizedType = personType === 'STUDENT' || personType === 'Student' ? 'Student' : 'Teacher';

    // Check if person is already in active presence
    const existingEntry = await prisma.activePresence.findFirst({
      where: {
        Zone_id: 1,
        PersonType: normalizedType,
        ...(normalizedType === 'Teacher' 
          ? { Teacher_ID: parseInt(personId) }
          : { Student_ID: parseInt(personId) }
        )
      }
    });

    if (existingEntry) {
      return res.status(200).json({
        success: true,
        message: 'Person already in zone',
        data: existingEntry
      });
    }

    // Add to active presence (only on Entry camera)
    if (cameraType === 'Entry') {
      const entryTime = new Date();
      
      // Create ActivePresence record
      const entry = await prisma.activePresence.create({
        data: {
          Zone_id: 1,
          PersonType: normalizedType,
          EntryTime: entryTime,
          ...(normalizedType === 'Teacher' 
            ? { Teacher_ID: parseInt(personId) }
            : { Student_ID: parseInt(personId) }
          )
        },
        include: {
          teacher: {
            select: {
              Teacher_ID: true,
              Name: true,
              Email: true,
              Department: true
            }
          },
          student: {
            select: {
              Student_ID: true,
              Name: true,
              Email: true,
              Department: true,
              RollNumber: true
            }
          },
          zone: {
            select: {
              Zone_id: true,
              Zone_Name: true
            }
          }
        }
      });

      // Also create TimeTable entry for tracking
      await prisma.timeTable.create({
        data: {
          Zone_id: 1,
          PersonType: normalizedType,
          EntryTime: entryTime,
          ...(normalizedType === 'Teacher' 
            ? { Teacher_ID: parseInt(personId) }
            : { Student_ID: parseInt(personId) }
          )
        }
      });

      console.log(`✅ Entry logged for ${normalizedType} ${personId}`);

      res.status(201).json({
        success: true,
        message: 'Person entry logged successfully',
        data: entry
      });
    } else if (cameraType === 'Exit' && existingEntry) {
      // Exit camera - trigger exit logic
      const exitTime = new Date();
      const durationMs = exitTime - new Date(existingEntry.EntryTime);
      const durationMinutes = Math.round(durationMs / 1000 / 60);

      // Create attendance log
      await prisma.attendanceLog.create({
        data: {
          Zone_id: 1,
          PersonType: normalizedType,
          EntryTime: existingEntry.EntryTime,
          ExitTime: exitTime,
          Duration: durationMinutes,
          ...(normalizedType === 'Teacher' 
            ? { Teacher_ID: parseInt(personId) }
            : { Student_ID: parseInt(personId) }
          )
        }
      });

      // Update TimeTable with exit time
      const timetableEntry = await prisma.timeTable.findFirst({
        where: {
          Zone_id: 1,
          PersonType: normalizedType,
          ExitTime: null,
          ...(normalizedType === 'Teacher' 
            ? { Teacher_ID: parseInt(personId) }
            : { Student_ID: parseInt(personId) }
          )
        },
        orderBy: {
          EntryTime: 'desc'
        }
      });

      if (timetableEntry) {
        await prisma.timeTable.update({
          where: {
            TimeTable_ID: timetableEntry.TimeTable_ID
          },
          data: {
            ExitTime: exitTime
          }
        });
      }

      // Remove from active presence
      await prisma.activePresence.delete({
        where: {
          Presence_ID: existingEntry.Presence_ID
        }
      });

      console.log(`🚪 Exit logged for ${normalizedType} ${personId} (${durationMinutes} min)`);

      res.status(200).json({
        success: true,
        message: 'Person exit logged successfully',
        data: {
          duration: durationMinutes,
          exitTime: exitTime
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: `${cameraType} detection acknowledged`,
        data: null
      });
    }

  } catch (error) {
    console.error('Error logging recognized person:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log person entry',
      error: error.message
    });
  }
};

/**
 * Log unknown person detection in Zone 1
 * POST /api/zones/1/unknown
 */
export const logUnknownPerson = async (req, res) => {
  try {
    const { capturedImage, confidence, notes } = req.body;

    if (!capturedImage) {
      return res.status(400).json({
        success: false,
        message: 'Captured image is required'
      });
    }

    // Convert base64 image to Buffer
    const imageBuffer = Buffer.from(capturedImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    const unknownFace = await prisma.unknownFaces.create({
      data: {
        Captured_Image: imageBuffer,
        Zone_id: 1,
        Confidence: confidence || 0,
        DetectedTime: new Date(),
        Status: 'PENDING',
        Notes: notes || 'Unknown person detected'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Unknown person logged successfully',
      data: {
        Unknown_ID: unknownFace.Unknown_ID,
        DetectedTime: unknownFace.DetectedTime,
        Status: unknownFace.Status
      }
    });

  } catch (error) {
    console.error('Error logging unknown person:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log unknown person',
      error: error.message
    });
  }
};

/**
 * Get all persons currently in Zone 1 (from ActivePresence)
 * GET /api/zones/1/current
 */
export const getCurrentPersons = async (req, res) => {
  try {
    const currentPersons = await prisma.activePresence.findMany({
      where: {
        Zone_id: 1
      },
      include: {
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Gender: true,
            Face_Picture_1: true
          }
        },
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Gender: true,
            RollNumber: true,
            Face_Picture_1: true
          }
        },
        zone: {
          select: {
            Zone_id: true,
            Zone_Name: true
          }
        }
      },
      orderBy: {
        EntryTime: 'desc'
      }
    });

    // Format response
    const formatted = currentPersons.map(entry => {
      const person = entry.student || entry.teacher;
      const duration = Math.floor((new Date() - new Date(entry.EntryTime)) / 60000); // minutes
      
      return {
        Presence_ID: entry.Presence_ID,
        PersonType: entry.PersonType,
        PersonID: entry.PersonType === 'Student' ? entry.Student_ID : entry.Teacher_ID,
        Name: person?.Name,
        Email: person?.Email,
        Department: person?.Department,
        Gender: person?.Gender,
        RollNumber: person?.RollNumber || null,
        Face_Picture: person?.Face_Picture_1,
        EntryTime: entry.EntryTime,
        Duration: duration + ' mins',
        Zone: entry.zone?.Zone_Name,
        Status: 'Inside'
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    console.error('Error fetching current persons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current persons',
      error: error.message
    });
  }
};

/**
 * Get all Zone 1 activity logs (from AttendanceLog)
 * GET /api/zones/1/logs
 */
export const getZoneLogs = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const logs = await prisma.attendanceLog.findMany({
      where: {
        Zone_id: 1
      },
      include: {
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Gender: true,
            Face_Picture_1: true
          }
        },
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Gender: true,
            RollNumber: true,
            Face_Picture_1: true
          }
        },
        zone: {
          select: {
            Zone_id: true,
            Zone_Name: true
          }
        }
      },
      orderBy: {
        EntryTime: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.attendanceLog.count({
      where: { Zone_id: 1 }
    });

    // Format response
    const formatted = logs.map(entry => {
      const person = entry.student || entry.teacher;
      
      return {
        Log_ID: entry.Log_ID,
        PersonType: entry.PersonType,
        PersonID: entry.PersonType === 'Student' ? entry.Student_ID : entry.Teacher_ID,
        Name: person?.Name,
        Email: person?.Email,
        Department: person?.Department,
        Gender: person?.Gender,
        RollNumber: person?.RollNumber || null,
        Face_Picture: person?.Face_Picture_1,
        EntryTime: entry.EntryTime,
        ExitTime: entry.ExitTime,
        Duration: entry.Duration ? entry.Duration + ' mins' : 'Ongoing',
        Zone: entry.zone?.Zone_Name,
        CreatedAt: entry.CreatedAt
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      total: total,
      data: formatted
    });

  } catch (error) {
    console.error('Error fetching zone logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone logs',
      error: error.message
    });
  }
};

/**
 * Get all students and teachers with face embeddings for matching
 * GET /api/zones/1/face-database
 */
export const getFaceDatabase = async (req, res) => {
  try {
    console.log('📚 Fetching face database from preprocessed images...');

    // Try to get preprocessed images first
    let faceData;
    try {
      faceData = await imagePreprocessingService.getPreprocessedImages();
      console.log(`✅ Using preprocessed images: ${faceData.students.length} students, ${faceData.teachers.length} teachers`);
    } catch (preprocessError) {
      console.warn('⚠️ Preprocessed images not available, falling back to original images');
      
      // Fallback to original method
      const students = await prisma.students.findMany({
        where: {
          Face_Embeddings: { not: null }
        },
        select: {
          Student_ID: true,
          Name: true,
          Email: true,
          Department: true,
          RollNumber: true,
          Face_Embeddings: true,
          Face_Picture_1: true
        }
      });

      const teachers = await prisma.teacher.findMany({
        where: {
          Face_Embeddings: { not: null }
        },
        select: {
          Teacher_ID: true,
          Name: true,
          Email: true,
          Department: true,
          Face_Embeddings: true,
          Face_Picture_1: true
        }
      });

      faceData = {
        students: students.map(s => ({
          id: s.Student_ID,
          name: s.Name,
          email: s.Email,
          department: s.Department,
          rollNumber: s.RollNumber,
          type: 'Student',
          enrolled: true,
          faceImage: s.Face_Picture_1,
          hasEmbeddings: s.Face_Embeddings !== null
        })),
        teachers: teachers.map(t => ({
          id: t.Teacher_ID,
          name: t.Name,
          email: t.Email,
          department: t.Department,
          type: 'Teacher',
          enrolled: true,
          faceImage: t.Face_Picture_1,
          hasEmbeddings: t.Face_Embeddings !== null
        }))
      };
    }

    // Debug logging
    if (faceData.students.length > 0) {
      console.log('✅ Students found:');
      faceData.students.forEach(s => {
        console.log(`  - ${s.name} (ID: ${s.id})`);
        console.log(`    Has faceImage: ${s.faceImage ? 'YES' : 'NO'}`);
        console.log(`    Has Embeddings: ${s.hasEmbeddings ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('⚠️ No students found with Face_Embeddings');
    }

    if (faceData.teachers.length > 0) {
      console.log('✅ Teachers found:');
      faceData.teachers.forEach(t => {
        console.log(`  - ${t.name} (ID: ${t.id})`);
        console.log(`    Has faceImage: ${t.faceImage ? 'YES' : 'NO'}`);
        console.log(`    Has Embeddings: ${t.hasEmbeddings ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('⚠️ No teachers found with Face_Embeddings');
    }

    res.status(200).json({
      success: true,
      data: {
        students: faceData.students,
        teachers: faceData.teachers,
        total: faceData.students.length + faceData.teachers.length,
        enrolled: faceData.students.length + faceData.teachers.length,
        usingPreprocessed: true
      }
    });

  } catch (error) {
    console.error('Error fetching face database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch face database',
      error: error.message
    });
  }
};

/**
 * Mark person exit from Zone 1 (via Exit camera)
 * PUT /api/zones/1/exit/:presenceId
 */
export const markExit = async (req, res) => {
  try {
    const { presenceId } = req.params;

    // Get active presence record
    const presence = await prisma.activePresence.findUnique({
      where: {
        Presence_ID: parseInt(presenceId)
      },
      include: {
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Email: true
          }
        },
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Email: true
          }
        }
      }
    });

    if (!presence) {
      return res.status(404).json({
        success: false,
        message: 'Active presence record not found'
      });
    }

    const exitTime = new Date();
    const duration = Math.floor((exitTime - new Date(presence.EntryTime)) / 60000); // minutes

    // Create attendance log
    const attendanceLog = await prisma.attendanceLog.create({
      data: {
        Zone_id: presence.Zone_id,
        PersonType: presence.PersonType,
        Student_ID: presence.Student_ID,
        Teacher_ID: presence.Teacher_ID,
        EntryTime: presence.EntryTime,
        ExitTime: exitTime,
        Duration: duration
      }
    });

    // Remove from active presence
    await prisma.activePresence.delete({
      where: {
        Presence_ID: parseInt(presenceId)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Exit recorded and moved to attendance log',
      data: {
        attendanceLog,
        person: presence.student || presence.teacher,
        duration: duration + ' mins'
      }
    });

  } catch (error) {
    console.error('Error marking exit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark exit',
      error: error.message
    });
  }
};

/**
 * Get unknown faces log
 * GET /api/zones/1/unknown-list
 */
export const getUnknownFaces = async (req, res) => {
  try {
    const { limit = 20, status } = req.query;

    const whereClause = {
      Zone_id: 1
    };

    if (status) {
      whereClause.Status = status;
    }

    const unknownFaces = await prisma.unknownFaces.findMany({
      where: whereClause,
      orderBy: {
        DetectedTime: 'desc'
      },
      take: parseInt(limit)
    });

    // Convert images to base64
    const formatted = unknownFaces.map(face => ({
      Unknown_ID: face.Unknown_ID,
      CapturedImage: face.Captured_Image 
        ? `data:image/jpeg;base64,${face.Captured_Image.toString('base64')}`
        : null,
      DetectedTime: face.DetectedTime,
      Confidence: face.Confidence,
      Status: face.Status,
      Notes: face.Notes
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    console.error('Error fetching unknown faces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unknown faces',
      error: error.message
    });
  }
};

/**
 * Update unknown face status
 * PUT /api/zones/1/unknown/:unknownId
 */
export const updateUnknownFaceStatus = async (req, res) => {
  try {
    const { unknownId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status
    const validStatuses = ['PENDING', 'IDENTIFIED', 'IGNORED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be PENDING, IDENTIFIED, or IGNORED'
      });
    }

    const updated = await prisma.unknownFaces.update({
      where: {
        Unknown_ID: parseInt(unknownId)
      },
      data: {
        Status: status,
        ...(notes && { Notes: notes })
      }
    });

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: {
        Unknown_ID: updated.Unknown_ID,
        Status: updated.Status,
        Notes: updated.Notes
      }
    });

  } catch (error) {
    console.error('Error updating unknown face status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
};

/**
 * Delete unknown face entry
 * DELETE /api/zones/1/unknown/:unknownId
 */
export const deleteUnknownFace = async (req, res) => {
  try {
    const { unknownId } = req.params;

    await prisma.unknownFaces.delete({
      where: {
        Unknown_ID: parseInt(unknownId)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Unknown face entry deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting unknown face:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete unknown face entry',
      error: error.message
    });
  }
};

/**
 * Get TimeTable logs with Entry/Exit data
 * GET /api/zones/1/timetable-logs
 */
export const getTimeTableLogs = async (req, res) => {
  try {
    const { limit = 50, offset = 0, personType, zoneId } = req.query;

    const where = {
      ...(zoneId && { Zone_id: parseInt(zoneId) }),
      ...(personType && { PersonType: personType })
    };

    const logs = await prisma.timeTable.findMany({
      where,
      include: {
        teacher: {
          select: {
            Teacher_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Gender: true,
            Face_Picture_1: true
          }
        },
        student: {
          select: {
            Student_ID: true,
            Name: true,
            Email: true,
            Department: true,
            Gender: true,
            RollNumber: true,
            Face_Picture_1: true
          }
        },
        zone: {
          select: {
            Zone_id: true,
            Zone_Name: true
          }
        }
      },
      orderBy: {
        EntryTime: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.timeTable.count({ where });

    // Format response with calculated duration
    const formatted = logs.map(entry => {
      const person = entry.student || entry.teacher;
      let duration = null;
      let status = 'Inside';

      if (entry.ExitTime && entry.EntryTime) {
        const durationMs = new Date(entry.ExitTime) - new Date(entry.EntryTime);
        duration = Math.round(durationMs / 1000 / 60); // minutes
        status = 'Completed';
      } else if (entry.EntryTime) {
        const durationMs = new Date() - new Date(entry.EntryTime);
        duration = Math.round(durationMs / 1000 / 60); // minutes
        status = 'Inside';
      }
      
      return {
        TimeTable_ID: entry.TimeTable_ID,
        PersonType: entry.PersonType,
        PersonID: entry.PersonType === 'Student' ? entry.Student_ID : entry.Teacher_ID,
        Name: person?.Name,
        Email: person?.Email,
        Department: person?.Department,
        Gender: person?.Gender,
        RollNumber: person?.RollNumber || null,
        Face_Picture: person?.Face_Picture_1,
        EntryTime: entry.EntryTime,
        ExitTime: entry.ExitTime,
        Duration: duration,
        Status: status,
        Zone: entry.zone?.Zone_Name || 'Unknown'
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      total: total,
      data: formatted,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + formatted.length < total
      }
    });

  } catch (error) {
    console.error('Error fetching TimeTable logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch TimeTable logs',
      error: error.message
    });
  }
};

/**
 * Debug endpoint - Get ALL students/teachers (for troubleshooting)
 * GET /api/zones/1/debug-database
 */
export const getDebugDatabase = async (req, res) => {
  try {
    // Get ALL students (not filtered by Face_Embeddings)
    const allStudents = await prisma.students.findMany({
      select: {
        Student_ID: true,
        Name: true,
        Email: true,
        RollNumber: true,
        Face_Embeddings: true,
        Face_Picture_1: true,
        Face_Picture_2: true,
        Face_Picture_3: true,
        Face_Picture_4: true,
        Face_Picture_5: true
      }
    });

    // Get ALL teachers
    const allTeachers = await prisma.teacher.findMany({
      select: {
        Teacher_ID: true,
        Name: true,
        Email: true,
        Face_Embeddings: true,
        Face_Picture_1: true,
        Face_Picture_2: true,
        Face_Picture_3: true,
        Face_Picture_4: true,
        Face_Picture_5: true
      }
    });

    const studentsDebug = allStudents.map(s => ({
      id: s.Student_ID,
      name: s.Name,
      email: s.Email,
      rollNumber: s.RollNumber,
      hasEmbeddings: s.Face_Embeddings !== null,
      hasPicture1: s.Face_Picture_1 !== null,
      hasPicture2: s.Face_Picture_2 !== null,
      hasPicture3: s.Face_Picture_3 !== null,
      hasPicture4: s.Face_Picture_4 !== null,
      hasPicture5: s.Face_Picture_5 !== null,
      picture1Length: s.Face_Picture_1?.length || 0
    }));

    const teachersDebug = allTeachers.map(t => ({
      id: t.Teacher_ID,
      name: t.Name,
      email: t.Email,
      hasEmbeddings: t.Face_Embeddings !== null,
      hasPicture1: t.Face_Picture_1 !== null,
      hasPicture2: t.Face_Picture_2 !== null,
      hasPicture3: t.Face_Picture_3 !== null,
      hasPicture4: t.Face_Picture_4 !== null,
      hasPicture5: t.Face_Picture_5 !== null,
      picture1Length: t.Face_Picture_1?.length || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        students: studentsDebug,
        teachers: teachersDebug,
        totalStudents: allStudents.length,
        totalTeachers: allTeachers.length,
        studentsWithEmbeddings: studentsDebug.filter(s => s.hasEmbeddings).length,
        teachersWithEmbeddings: teachersDebug.filter(t => t.hasEmbeddings).length
      }
    });

  } catch (error) {
    console.error('Error fetching debug database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch debug database',
      error: error.message
    });
  }
};
