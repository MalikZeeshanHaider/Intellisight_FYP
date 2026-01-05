import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data and reset primary key sequences so IDs start from 1
  console.log('🗑️  Clearing existing data and resetting sequences...');
  // Using TRUNCATE with RESTART IDENTITY to ensure deterministic IDs for tests
  await prisma.$executeRawUnsafe('TRUNCATE "AttendanceLog", "ActivePresence", "Logs", "ProcessedFaceImages", "FaceEmbeddings", "UnknownFaces", "Students", "Teacher", "Camara", "Admin", "Zone" RESTART IDENTITY CASCADE');

  // Hash password for admins
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Seed Admins
  console.log('👤 Seeding Admins...');
  const admins = await Promise.all([
    prisma.admin.create({
      data: {
        Name: 'John Administrator',
        Email: 'john.admin@intellisight.com',
        Password: hashedPassword,
        Role: 'Super Admin',
      },
    }),
    prisma.admin.create({
      data: {
        Name: 'Sarah Manager',
        Email: 'sarah.manager@intellisight.com',
        Password: hashedPassword,
        Role: 'Manager',
      },
    }),
    prisma.admin.create({
      data: {
        Name: 'Mike Coordinator',
        Email: 'mike.coord@intellisight.com',
        Password: hashedPassword,
        Role: 'Coordinator',
      },
    }),
  ]);
  console.log(`✅ Created ${admins.length} admins`);

  // Seed Zones
  console.log('🏢 Seeding Zones...');
  const zones = await Promise.all([
    prisma.zone.create({ data: { Zone_Name: 'Main Building - Floor 1' } }),
    prisma.zone.create({ data: { Zone_Name: 'Main Building - Floor 2' } }),
    prisma.zone.create({ data: { Zone_Name: 'Science Lab Block' } }),
    prisma.zone.create({ data: { Zone_Name: 'Library Zone' } }),
    prisma.zone.create({ data: { Zone_Name: 'Cafeteria Area' } }),
  ]);
  console.log(`✅ Created ${zones.length} zones`);

  // Seed Cameras
  console.log('📹 Seeding Cameras...');
  const cameras = await Promise.all([
    prisma.camara.create({
      data: { Password: 'cam_pass_001', Zone_id: zones[0].Zone_id },
    }),
    prisma.camara.create({
      data: { Password: 'cam_pass_002', Zone_id: zones[0].Zone_id },
    }),
    prisma.camara.create({
      data: { Password: 'cam_pass_003', Zone_id: zones[1].Zone_id },
    }),
    prisma.camara.create({
      data: { Password: 'cam_pass_004', Zone_id: zones[2].Zone_id },
    }),
    prisma.camara.create({
      data: { Password: 'cam_pass_005', Zone_id: zones[3].Zone_id },
    }),
    prisma.camara.create({
      data: { Password: 'cam_pass_006', Zone_id: zones[4].Zone_id },
    }),
  ]);
  console.log(`✅ Created ${cameras.length} cameras`);

  // Seed Teachers
  console.log('👨‍🏫 Seeding Teachers...');
  const teachers = await Promise.all([
    prisma.teacher.create({
      data: {
        Name: 'Dr. Emma Watson',
        Email: 'emma.watson@intellisight.edu',
        Department: 'Computer Science',
        Faculty_Type: 'Professor',
        Gender: 'Female',
      },
    }),
    prisma.teacher.create({
      data: {
        Name: 'Prof. Robert Johnson',
        Email: 'robert.johnson@intellisight.edu',
        Department: 'Mathematics',
        Faculty_Type: 'Professor',
        Gender: 'Male',
      },
    }),
    prisma.teacher.create({
      data: {
        Name: 'Dr. Lisa Chen',
        Email: 'lisa.chen@intellisight.edu',
        Department: 'Physics',
        Faculty_Type: 'Associate Professor',
        Gender: 'Female',
      },
    }),
    prisma.teacher.create({
      data: {
        Name: 'Prof. David Miller',
        Email: 'david.miller@intellisight.edu',
        Department: 'Chemistry',
        Faculty_Type: 'Professor',
        Gender: 'Male',
      },
    }),
    prisma.teacher.create({
      data: {
        Name: 'Dr. Sophia Martinez',
        Email: 'sophia.martinez@intellisight.edu',
        Department: 'Biology',
        Faculty_Type: 'Assistant Professor',
        Gender: 'Female',
      },
    }),
  ]);
  console.log(`✅ Created ${teachers.length} teachers`);

  // Seed Students
  console.log('👨‍🎓 Seeding Students...');
  const students = await Promise.all([
    prisma.students.create({
      data: {
        Name: 'Alice Williams',
        Email: 'alice.w@student.intellisight.edu',
        RollNumber: 'STU001',
        Department: 'Computer Science',
        Gender: 'Female',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'Bob Taylor',
        Email: 'bob.t@student.intellisight.edu',
        RollNumber: 'STU002',
        Department: 'Computer Science',
        Gender: 'Male',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'Charlie Brown',
        Email: 'charlie.b@student.intellisight.edu',
        RollNumber: 'STU003',
        Department: 'Mathematics',
        Gender: 'Male',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'Diana Prince',
        Email: 'diana.p@student.intellisight.edu',
        RollNumber: 'STU004',
        Department: 'Physics',
        Gender: 'Female',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'Edward Norton',
        Email: 'edward.n@student.intellisight.edu',
        RollNumber: 'STU005',
        Department: 'Chemistry',
        Gender: 'Male',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'Fiona Green',
        Email: 'fiona.g@student.intellisight.edu',
        RollNumber: 'STU006',
        Department: 'Biology',
        Gender: 'Female',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'George Harris',
        Email: 'george.h@student.intellisight.edu',
        RollNumber: 'STU007',
        Department: 'Mathematics',
        Gender: 'Male',
      },
    }),
    prisma.students.create({
      data: {
        Name: 'Hannah Lee',
        Email: 'hannah.l@student.intellisight.edu',
        RollNumber: 'STU008',
        Department: 'Computer Science',
        Gender: 'Female',
      },
    }),
  ]);
  console.log(`✅ Created ${students.length} students`);

  // Seed AttendanceLog entries (replaced TimeTable)
  console.log('⏰ Seeding AttendanceLog entries...');
  const now = new Date();
  
  const attendanceEntries = await Promise.all([
    // Teacher entries
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        ExitTime: new Date(now.getTime() - 30 * 60 * 1000), // 30 mins ago
        PersonType: 'TEACHER',
        Teacher_ID: teachers[0].Teacher_ID,
        Zone_id: zones[0].Zone_id,
        Duration: 90,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
        ExitTime: new Date(now.getTime() - 1 * 60 * 60 * 1000), // Exited 1 hour ago
        PersonType: 'TEACHER',
        Teacher_ID: teachers[1].Teacher_ID,
        Zone_id: zones[1].Zone_id,
        Duration: 120,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
        ExitTime: new Date(now.getTime() - 15 * 60 * 1000), // 15 mins ago
        PersonType: 'TEACHER',
        Teacher_ID: teachers[2].Teacher_ID,
        Zone_id: zones[2].Zone_id,
        Duration: 45,
      },
    }),
    // Student entries
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        ExitTime: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
        PersonType: 'STUDENT',
        Student_ID: students[0].Student_ID,
        Zone_id: zones[0].Zone_id,
        Duration: 180,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
        ExitTime: new Date(now.getTime() - 30 * 60 * 1000), // Exited 30 mins ago
        PersonType: 'STUDENT',
        Student_ID: students[1].Student_ID,
        Zone_id: zones[0].Zone_id,
        Duration: 150,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
        ExitTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        PersonType: 'STUDENT',
        Student_ID: students[2].Student_ID,
        Zone_id: zones[1].Zone_id,
        Duration: 180,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        ExitTime: null, // Still inside
        PersonType: 'STUDENT',
        Student_ID: students[3].Student_ID,
        Zone_id: zones[2].Zone_id,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
        ExitTime: new Date(now.getTime() - 10 * 60 * 1000), // 10 mins ago
        PersonType: 'STUDENT',
        Student_ID: students[4].Student_ID,
        Zone_id: zones[3].Zone_id,
        Duration: 50,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
        ExitTime: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
        PersonType: 'STUDENT',
        Student_ID: students[5].Student_ID,
        Zone_id: zones[0].Zone_id,
        Duration: 180,
      },
    }),
    prisma.attendanceLog.create({
      data: {
        EntryTime: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        ExitTime: null, // Still inside
        PersonType: 'STUDENT',
        Student_ID: students[6].Student_ID,
        Zone_id: zones[1].Zone_id,
      },
    }),
  ]);
  console.log(`✅ Created ${attendanceEntries.length} attendance log entries`);

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Admins: ${admins.length}`);
  console.log(`   - Zones: ${zones.length}`);
  console.log(`   - Cameras: ${cameras.length}`);
  console.log(`   - Teachers: ${teachers.length}`);
  console.log(`   - Students: ${students.length}`);
  console.log(`   - Attendance Entries: ${attendanceEntries.length}`);
  console.log('\n🔑 Test Admin Credentials:');
  console.log('   Email: john.admin@intellisight.com');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
