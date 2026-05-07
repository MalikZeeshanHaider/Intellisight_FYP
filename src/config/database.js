import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Test database connection
async function testConnection() {
  try {
    await prisma.$connect();
    // Force UTC session timezone so TIMESTAMP columns are always interpreted as UTC,
    // matching what the Python service stores.
    await prisma.$executeRawUnsafe(`SET TIME ZONE 'UTC'`);
    console.log('✅ Database connected successfully (session timezone = UTC)');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
async function disconnect() {
  await prisma.$disconnect();
  console.log('Database disconnected');
}

export { prisma, testConnection, disconnect };
