/**
 * Daily Reset Service
 * Handles automatic daily reset of active presence and statistics
 * Preserves attendance history while resetting current day counters
 */

import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';
import cron from 'node-cron';

/**
 * Reset active presence at day end
 * Moves active users to attendance log before clearing
 */
export const resetDailyActivePresence = async () => {
  try {
    logger.info('🔄 Starting daily active presence reset...');

    // Get all active presence records before clearing
    const activeRecords = await prisma.activePresence.findMany({
      include: {
        Zone: true,
        Students: true,
        Teacher: true,
      },
    });

    logger.info(`Found ${activeRecords.length} active presence records to process`);

    // Move each to attendance log if they haven't exited properly
    for (const record of activeRecords) {
      try {
        // Check if already logged for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingLog = await prisma.attendanceLog.findFirst({
          where: {
            PersonType: record.PersonType,
            Student_ID: record.Student_ID,
            Teacher_ID: record.Teacher_ID,
            Zone_id: record.Zone_id,
            EntryTime: {
              gte: today,
            },
          },
        });

        if (!existingLog) {
          // Create attendance log for incomplete exit
          const now = new Date();
          await prisma.attendanceLog.create({
            data: {
              PersonType: record.PersonType,
              Student_ID: record.Student_ID,
              Teacher_ID: record.Teacher_ID,
              Zone_id: record.Zone_id,
              EntryTime: record.EntryTime,
              ExitTime: now, // Auto-exit at day end
              Duration: Math.floor((now - record.EntryTime) / 60000), // Duration in minutes
            },
          });

          logger.info(`✓ Auto-logged exit for ${record.PersonType} ID: ${record.Student_ID || record.Teacher_ID} from Zone ${record.Zone_id}`);
        }
      } catch (error) {
        logger.error(`Error processing record ${record.Presence_ID}:`, error);
      }
    }

    // Clear all active presence records
    const result = await prisma.activePresence.deleteMany({});
    logger.info(`✅ Cleared ${result.count} active presence records`);

    return {
      success: true,
      recordsCleared: result.count,
      recordsLogged: activeRecords.length,
    };
  } catch (error) {
    logger.error('❌ Error resetting daily active presence:', error);
    throw error;
  }
};

/**
 * Clean up old unknown faces (optional - keep last 7 days)
 */
export const cleanupOldUnknownFaces = async (daysToKeep = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.unknownFaces.deleteMany({
      where: {
        DetectedTime: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`🗑️ Cleaned up ${result.count} old unknown face records (older than ${daysToKeep} days)`);
    return result.count;
  } catch (error) {
    logger.error('Error cleaning up old unknown faces:', error);
    throw error;
  }
};

/**
 * Get daily statistics for dashboard
 */
export const getDailyStatistics = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's attendance logs
    const todayLogs = await prisma.attendanceLog.count({
      where: {
        EntryTime: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Get last 7 days attendance
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const last7DaysLogs = await prisma.attendanceLog.count({
      where: {
        EntryTime: {
          gte: sevenDaysAgo,
          lt: tomorrow,
        },
      },
    });

    // Get current active presence
    const activePresence = await prisma.activePresence.count();

    return {
      today: todayLogs,
      last7Days: last7DaysLogs,
      currentActive: activePresence,
    };
  } catch (error) {
    logger.error('Error getting daily statistics:', error);
    throw error;
  }
};

/**
 * Schedule daily reset job
 * Runs at midnight every day (00:00)
 */
export const scheduleDailyReset = () => {
  // Run at midnight every day (00:00:00)
  cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Triggered scheduled daily reset at midnight');
    try {
      await resetDailyActivePresence();
      await cleanupOldUnknownFaces(7); // Keep 7 days of unknown faces
      logger.info('✅ Daily reset completed successfully');
    } catch (error) {
      logger.error('❌ Daily reset failed:', error);
    }
  });

  logger.info('📅 Daily reset scheduler initialized (runs at 00:00)');
};

/**
 * Manual reset trigger (for testing or admin action)
 */
export const triggerManualReset = async () => {
  logger.info('🔧 Manual reset triggered by admin');
  const result = await resetDailyActivePresence();
  await cleanupOldUnknownFaces(7);
  return result;
};

export default {
  resetDailyActivePresence,
  cleanupOldUnknownFaces,
  getDailyStatistics,
  scheduleDailyReset,
  triggerManualReset,
};
