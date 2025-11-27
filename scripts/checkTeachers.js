import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTeachers() {
  try {
    console.log('=== Fetching Teachers from Database ===\n');
    
    const teachers = await prisma.teacher.findMany({
      orderBy: { Teacher_ID: 'desc' },
      take: 10
    });

    if (teachers.length === 0) {
      console.log('No teachers found in the database.');
    } else {
      console.log(`Total teachers found: ${teachers.length}\n`);
      
      teachers.forEach((teacher, index) => {
        console.log(`Teacher ${index + 1}:`);
        console.log(`  ID: ${teacher.Teacher_ID}`);
        console.log(`  Name: ${teacher.Name}`);
        console.log(`  Email: ${teacher.Email}`);
        console.log(`  Gender: ${teacher.Gender || 'Not specified'}`);
        console.log(`  Faculty Type: ${teacher.Faculty_Type || 'Not specified'}`);
        console.log(`  Department: ${teacher.Department || 'Not specified'}`);
        console.log(`  Face Pictures:`);
        console.log(`    Picture 1: ${teacher.Face_Picture_1 ? '✓ Present' : '✗ Missing'}`);
        console.log(`    Picture 2: ${teacher.Face_Picture_2 ? '✓ Present' : '✗ Missing'}`);
        console.log(`    Picture 3: ${teacher.Face_Picture_3 ? '✓ Present' : '✗ Missing'}`);
        console.log(`    Picture 4: ${teacher.Face_Picture_4 ? '✓ Present' : '✗ Missing'}`);
        console.log(`    Picture 5: ${teacher.Face_Picture_5 ? '✓ Present' : '✗ Missing'}`);
        console.log(`  Created: ${teacher.Created_at}`);
        console.log('---\n');
      });
    }
    
    // Get count
    const count = await prisma.teacher.count();
    console.log(`\nTotal teachers in database: ${count}`);
    
  } catch (error) {
    console.error('Error fetching teachers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeachers();
