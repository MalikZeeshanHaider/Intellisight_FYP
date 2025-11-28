import dotenv from 'dotenv';
import app from './app.js';
import { testConnection, disconnect } from './config/database.js';
import logger from './utils/logger.js';
import imagePreprocessingService from './services/imagePreprocessing.service.js';

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
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default server;
