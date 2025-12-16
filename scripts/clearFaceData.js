/**
 * Clear all face recognition data from the database
 * Run with: node scripts/clearFaceData.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearFaceData() {
  console.log('Clearing all face recognition data...\n');

  try {
    // Clear FaceEmbeddings table
    const deletedEmbeddings = await prisma.faceEmbeddings.deleteMany();
    console.log(`[OK] Deleted ${deletedEmbeddings.count} records from FaceEmbeddings`);

    // Clear ProcessedFaceImages table
    const deletedProcessed = await prisma.processedFaceImages.deleteMany();
    console.log(`[OK] Deleted ${deletedProcessed.count} records from ProcessedFaceImages`);

    // Clear face pictures and embeddings from Students
    const updatedStudents = await prisma.students.updateMany({
      data: {
        Face_Picture_1: null,
        Face_Picture_2: null,
        Face_Picture_3: null,
        Face_Picture_4: null,
        Face_Picture_5: null,
        Face_Embeddings: null
      }
    });
    console.log(`[OK] Cleared face data from ${updatedStudents.count} students`);

    // Clear face pictures and embeddings from Teachers
    const updatedTeachers = await prisma.teacher.updateMany({
      data: {
        Face_Picture_1: null,
        Face_Picture_2: null,
        Face_Picture_3: null,
        Face_Picture_4: null,
        Face_Picture_5: null,
        Face_Embeddings: null
      }
    });
    console.log(`[OK] Cleared face data from ${updatedTeachers.count} teachers`);

    console.log('\n[SUCCESS] All face recognition data has been cleared!');
    console.log('You can now add new students/teachers with face pictures through the UI.');

  } catch (error) {
    console.error('[ERROR] Failed to clear face data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearFaceData();
