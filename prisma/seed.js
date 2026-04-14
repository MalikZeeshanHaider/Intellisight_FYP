import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data and reset primary key sequences so IDs start from 1
  console.log('🗑️  Clearing existing data and resetting sequences...');
  // Using TRUNCATE with RESTART IDENTITY to ensure deterministic IDs for tests
  await prisma.$executeRawUnsafe('TRUNCATE "ClassAttendance", "TimetableSlot", "Enrollment", "Section", "Course", "AttendanceLog", "ActivePresence", "Logs", "ProcessedFaceImages", "FaceEmbeddings", "UnknownFaces", "Students", "Teacher", "Camara", "Admin", "Zone" RESTART IDENTITY CASCADE');

  // Hash password for seed admin — read from env so no plaintext secret in source
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedAdminPassword) {
    console.error('[FATAL] SEED_ADMIN_PASSWORD is not set in .env');
    process.exit(1);
  }
  const hashedPassword = await bcrypt.hash(seedAdminPassword, 10);

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

  // ── Seed Courses ───────────────────────────────────────────────
  console.log('📚 Seeding Courses...');
  const courses = await Promise.all([
    prisma.course.create({
      data: { Name: 'Object Oriented Programming', Code: 'CS-301', CreditHours: 3, Department: 'Computer Science' },
    }),
    prisma.course.create({
      data: { Name: 'Data Structures & Algorithms', Code: 'CS-302', CreditHours: 3, Department: 'Computer Science' },
    }),
    prisma.course.create({
      data: { Name: 'Database Systems', Code: 'CS-401', CreditHours: 3, Department: 'Computer Science' },
    }),
    prisma.course.create({
      data: { Name: 'Software Engineering', Code: 'CS-402', CreditHours: 3, Department: 'Computer Science' },
    }),
    prisma.course.create({
      data: { Name: 'Calculus II', Code: 'MATH-201', CreditHours: 3, Department: 'Mathematics' },
    }),
  ]);
  console.log(`✅ Created ${courses.length} courses`);

  // ── Seed Sections ──────────────────────────────────────────────
  console.log('🏫 Seeding Sections...');
  const sections = await Promise.all([
    prisma.section.create({
      data: { Name: 'BSIT-VIII-A (Shift-I)', Department: 'Computer Science', Semester: '8th', Shift: 'Morning' },
    }),
    prisma.section.create({
      data: { Name: 'BSIT-VIII-B (Shift-I)', Department: 'Computer Science', Semester: '8th', Shift: 'Morning' },
    }),
    prisma.section.create({
      data: { Name: 'BSCS-VI-A (Shift-II)', Department: 'Computer Science', Semester: '6th', Shift: 'Evening' },
    }),
  ]);
  console.log(`✅ Created ${sections.length} sections`);

  // ── Seed Enrollments ───────────────────────────────────────────
  console.log('📋 Seeding Enrollments...');
  // Section A → students 0,1,3,4
  // Section B → students 2,5,6,7
  // Section C → students 0,2,4
  const enrollmentsData = [
    { Section_ID: sections[0].Section_ID, Student_ID: students[0].Student_ID },
    { Section_ID: sections[0].Section_ID, Student_ID: students[1].Student_ID },
    { Section_ID: sections[0].Section_ID, Student_ID: students[3].Student_ID },
    { Section_ID: sections[0].Section_ID, Student_ID: students[4].Student_ID },
    { Section_ID: sections[1].Section_ID, Student_ID: students[2].Student_ID },
    { Section_ID: sections[1].Section_ID, Student_ID: students[5].Student_ID },
    { Section_ID: sections[1].Section_ID, Student_ID: students[6].Student_ID },
    { Section_ID: sections[1].Section_ID, Student_ID: students[7].Student_ID },
    { Section_ID: sections[2].Section_ID, Student_ID: students[0].Student_ID },
    { Section_ID: sections[2].Section_ID, Student_ID: students[2].Student_ID },
    { Section_ID: sections[2].Section_ID, Student_ID: students[4].Student_ID },
  ];
  await prisma.enrollment.createMany({ data: enrollmentsData });
  console.log(`✅ Created ${enrollmentsData.length} enrollments`);

  // ── Seed TimetableSlots ─────────────────────────────────────────
  console.log('📅 Seeding TimetableSlots...');
  // Section BSIT-VIII-A: Mon-Fri schedule
  const slotsData = [
    // BSIT-VIII-A (Shift-I) — Section A
    { Section_ID: sections[0].Section_ID, Course_ID: courses[0].Course_ID, Teacher_ID: teachers[0].Teacher_ID, SubjectName: 'Object Oriented Programming', DayOfWeek: 'MON', StartTime: '09:00', EndTime: '10:00', Zone_id: zones[0].Zone_id },
    { Section_ID: sections[0].Section_ID, Course_ID: courses[1].Course_ID, Teacher_ID: teachers[1].Teacher_ID, SubjectName: 'Data Structures & Algorithms', DayOfWeek: 'MON', StartTime: '10:00', EndTime: '11:00', Zone_id: zones[0].Zone_id },
    { Section_ID: sections[0].Section_ID, Course_ID: courses[2].Course_ID, Teacher_ID: teachers[0].Teacher_ID, SubjectName: 'Database Systems', DayOfWeek: 'TUE', StartTime: '09:00', EndTime: '10:30', Zone_id: zones[1].Zone_id },
    { Section_ID: sections[0].Section_ID, Course_ID: courses[3].Course_ID, Teacher_ID: teachers[2].Teacher_ID, SubjectName: 'Software Engineering', DayOfWeek: 'WED', StartTime: '11:00', EndTime: '12:00', Zone_id: zones[0].Zone_id },
    { Section_ID: sections[0].Section_ID, Course_ID: courses[4].Course_ID, Teacher_ID: teachers[1].Teacher_ID, SubjectName: 'Calculus II', DayOfWeek: 'THU', StartTime: '09:00', EndTime: '10:00', Zone_id: zones[1].Zone_id },
    { Section_ID: sections[0].Section_ID, Course_ID: courses[0].Course_ID, Teacher_ID: teachers[0].Teacher_ID, SubjectName: 'Object Oriented Programming (Lab)', DayOfWeek: 'FRI', StartTime: '14:00', EndTime: '16:00', Zone_id: zones[2].Zone_id },
    // BSIT-VIII-B (Shift-I) — Section B
    { Section_ID: sections[1].Section_ID, Course_ID: courses[0].Course_ID, Teacher_ID: teachers[3].Teacher_ID, SubjectName: 'Object Oriented Programming', DayOfWeek: 'MON', StartTime: '11:00', EndTime: '12:00', Zone_id: zones[1].Zone_id },
    { Section_ID: sections[1].Section_ID, Course_ID: courses[2].Course_ID, Teacher_ID: teachers[4].Teacher_ID, SubjectName: 'Database Systems', DayOfWeek: 'TUE', StartTime: '10:00', EndTime: '11:00', Zone_id: zones[0].Zone_id },
    { Section_ID: sections[1].Section_ID, Course_ID: courses[3].Course_ID, Teacher_ID: teachers[2].Teacher_ID, SubjectName: 'Software Engineering', DayOfWeek: 'WED', StartTime: '09:00', EndTime: '10:00', Zone_id: zones[1].Zone_id },
    // BSCS-VI-A (Shift-II) — Section C (Evening)
    { Section_ID: sections[2].Section_ID, Course_ID: courses[1].Course_ID, Teacher_ID: teachers[3].Teacher_ID, SubjectName: 'Data Structures & Algorithms', DayOfWeek: 'MON', StartTime: '16:00', EndTime: '17:00', Zone_id: zones[0].Zone_id },
    { Section_ID: sections[2].Section_ID, Course_ID: courses[4].Course_ID, Teacher_ID: teachers[4].Teacher_ID, SubjectName: 'Calculus II', DayOfWeek: 'WED', StartTime: '17:00', EndTime: '18:00', Zone_id: zones[1].Zone_id },
  ];
  await prisma.timetableSlot.createMany({ data: slotsData });
  console.log(`✅ Created ${slotsData.length} timetable slots`);

  console.log('\n📊 Summary:');
  console.log(`   - Admins: ${admins.length}`);
  console.log(`   - Zones: ${zones.length}`);
  console.log(`   - Cameras: ${cameras.length}`);
  console.log(`   - Teachers: ${teachers.length}`);
  console.log(`   - Students: ${students.length}`);
  console.log(`   - Attendance Entries: ${attendanceEntries.length}`);
  console.log(`   - Courses: ${courses.length}`);
  console.log(`   - Sections: ${sections.length}`);
  console.log(`   - Enrollments: ${enrollmentsData.length}`);
  console.log(`   - Timetable Slots: ${slotsData.length}`);
  console.log('\n🔑 Test Admin Credentials:');
  console.log('   Email: john.admin@intellisight.com');
  console.log('   Password: (value of SEED_ADMIN_PASSWORD in your .env)');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
