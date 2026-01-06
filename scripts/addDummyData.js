import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addDummyData() {
  try {
    console.log('🚀 Starting to add dummy data...\n');

    // 1. Add Zones
    console.log('📍 Adding Zones...');
    const zone1 = await prisma.zone.upsert({
      where: { Zone_id: 1 },
      update: {},
      create: {
        Zone_Name: 'Main Building - Ground Floor',
      },
    });

    const zone2 = await prisma.zone.upsert({
      where: { Zone_id: 2 },
      update: {},
      create: {
        Zone_Name: 'Library Section',
      },
    });

    const zone3 = await prisma.zone.upsert({
      where: { Zone_id: 3 },
      update: {},
      create: {
        Zone_Name: 'Computer Lab',
      },
    });

    console.log(`✅ Added 3 zones`);

    // 2. Add Cameras
    console.log('\n📷 Adding Cameras...');
    const camera1 = await prisma.camara.upsert({
      where: { Camara_Id: 1 },
      update: {},
      create: {
        Password: 'camera123',
        Zone_id: zone1.Zone_id,
      },
    });

    const camera2 = await prisma.camara.upsert({
      where: { Camara_Id: 2 },
      update: {},
      create: {
        Password: 'camera456',
        Zone_id: zone1.Zone_id,
      },
    });

    const camera3 = await prisma.camara.upsert({
      where: { Camara_Id: 3 },
      update: {},
      create: {
        Password: 'camera789',
        Zone_id: zone2.Zone_id,
      },
    });

    const camera4 = await prisma.camara.upsert({
      where: { Camara_Id: 4 },
      update: {},
      create: {
        Password: 'camera101',
        Zone_id: zone3.Zone_id,
      },
    });

    console.log(`✅ Added 4 cameras`);

    // 3. Get existing students and teachers
    console.log('\n👥 Fetching existing students and teachers...');
    const students = await prisma.students.findMany({ take: 2 });
    const teachers = await prisma.teacher.findMany({ take: 2 });

    console.log(`Found ${students.length} students and ${teachers.length} teachers`);

    // 4. Add TimeTable entries
    console.log('\n⏰ Adding TimeTable entries...');
    let timetableCount = 0;

    // Add entries for students
    for (const student of students) {
      // Entry 1: Entered zone 1
      await prisma.timeTable.create({
        data: {
          EntryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          PersonType: 'Student',
          Student_ID: student.Student_ID,
          Zone_id: zone1.Zone_id,
        },
      });
      timetableCount++;

      // Entry 2: Moved to zone 2
      await prisma.timeTable.create({
        data: {
          EntryTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
          ExitTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          PersonType: 'Student',
          Student_ID: student.Student_ID,
          Zone_id: zone2.Zone_id,
        },
      });
      timetableCount++;
    }

    // Add entries for teachers
    for (const teacher of teachers) {
      // Entry 1: Entered zone 3
      await prisma.timeTable.create({
        data: {
          EntryTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          PersonType: 'Teacher',
          Teacher_ID: teacher.Teacher_ID,
          Zone_id: zone3.Zone_id,
        },
      });
      timetableCount++;

      // Entry 2: Still in zone 1
      await prisma.timeTable.create({
        data: {
          EntryTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          PersonType: 'Teacher',
          Teacher_ID: teacher.Teacher_ID,
          Zone_id: zone1.Zone_id,
        },
      });
      timetableCount++;
    }

    console.log(`✅ Added ${timetableCount} timetable entries`);

    // 5. Add Unknown Faces
    console.log('\n👤 Adding Unknown Faces...');
    const unknownFace1 = await prisma.unknownFaces.create({
      data: {
        Captured_Image: Buffer.from('fake_image_data_1'),
        DetectedTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        Zone_id: zone1.Zone_id,
        Confidence: 0.85,
        Status: 'PENDING',
      },
    });

    const unknownFace2 = await prisma.unknownFaces.create({
      data: {
        Captured_Image: Buffer.from('fake_image_data_2'),
        DetectedTime: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        Zone_id: zone2.Zone_id,
        Confidence: 0.92,
        Status: 'REVIEWED',
      },
    });

    const unknownFace3 = await prisma.unknownFaces.create({
      data: {
        Captured_Image: Buffer.from('fake_image_data_3'),
        DetectedTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        Zone_id: zone3.Zone_id,
        Confidence: 0.78,
        Status: 'PENDING',
      },
    });

    console.log(`✅ Added 3 unknown faces`);

    // Summary
    console.log('\n📊 Summary:');
    const zoneCounts = await prisma.zone.count();
    const cameraCount = await prisma.camara.count();
    const studentCount = await prisma.students.count();
    const teacherCount = await prisma.teacher.count();
    const timetableTotal = await prisma.timeTable.count();
    const unknownFaceCount = await prisma.unknownFaces.count();

    console.log(`✅ Zones: ${zoneCounts}`);
    console.log(`✅ Cameras: ${cameraCount}`);
    console.log(`✅ Students: ${studentCount}`);
    console.log(`✅ Teachers: ${teacherCount}`);
    console.log(`✅ TimeTable Entries: ${timetableTotal}`);
    console.log(`✅ Unknown Faces: ${unknownFaceCount}`);

    console.log('\n✨ Dummy data added successfully!');
  } catch (error) {
    console.error('❌ Error adding dummy data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addDummyData();
