/**
 * Health Check Controller
 * Provides system health and database connectivity status
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Health check endpoint
 * GET /api/health
 */
export const healthCheck = async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Get basic stats
    const [studentCount, teacherCount, zoneCount] = await Promise.all([
      prisma.students.count(),
      prisma.teacher.count(),
      prisma.zone.count()
    ]);

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        students: studentCount,
        teachers: teacherCount,
        zones: zoneCount
      },
      server: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message
      }
    });
  }
};
