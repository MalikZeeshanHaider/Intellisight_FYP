import dotenv from 'dotenv';
import app from './app.js';
import { testConnection, disconnect } from './config/database.js';
import logger from './utils/logger.js';
import imagePreprocessingService from './services/imagePreprocessing.service.js';
import { initializePythonServices, stopAllProcesses } from './services/pythonService.js';
import { scheduleDailyReset } from './services/dailyReset.service.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Test database connection before starting server
await testConnection();

// Preprocess all images on startup
logger.info('🔄 Starting image preprocessing...');
try {
  const result = await imagePreprocessingService.preprocessAllImages();
  logger.info(`✅ Image preprocessing complete! Processed ${result.processed} people`);
} catch (error) {
  logger.warn('⚠️ Image preprocessing failed, system will use original images:', error.message);
}

// Initialize Python face recognition services
logger.info('🐍 Initializing Python face recognition...');
try {
  const pythonResult = await initializePythonServices();
  logger.info(`✅ ${pythonResult.message}`);
} catch (error) {
  logger.warn('⚠️ Python services initialization failed:', error.message);
}

// Initialize daily reset scheduler
logger.info('📅 Initializing daily reset scheduler...');
try {
  scheduleDailyReset();
  logger.info('✅ Daily reset scheduler initialized (runs at midnight)');
} catch (error) {
  logger.warn('⚠️ Daily reset scheduler failed:', error.message);
}

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📚 API base URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received. Closing server gracefully...`);

  // Stop all Python processes
  stopAllProcesses();

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log but don't crash the server for non-critical rejections
  // Only shutdown for critical errors like database disconnection
  const errorMessage = reason?.message || String(reason);
  const isCriticalError = errorMessage.includes('database') || 
                          errorMessage.includes('ECONNREFUSED') ||
                          errorMessage.includes('prisma');
  
  if (isCriticalError) {
    logger.error('Critical error detected, shutting down...');
    gracefulShutdown('UNHANDLED_REJECTION');
  } else {
    logger.warn('Non-critical unhandled rejection, server continuing...');
  }
});

export default server;

