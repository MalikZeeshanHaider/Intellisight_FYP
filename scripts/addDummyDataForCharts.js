/**
 * Add Dummy Data for Charts and Graphs
 * This script populates the database with sample data for visualization testing
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper to generate random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to generate random integer
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sample data
const departments = ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Business Administration', 'Mathematics', 'Physics', 'Chemistry'];
const facultyTypes = ['Permanent', 'Visiting', 'Contract'];
const genders = ['Male', 'Female'];

const studentNames = [
  'Ahmed Hassan', 'Sara Ali', 'Muhammad Khan', 'Fatima Zahra', 'Usman Tariq',
  'Ayesha Malik', 'Bilal Ahmed', 'Zainab Fatima', 'Omar Farooq', 'Hira Shahid',
  'Ali Raza', 'Maryam Noor', 'Hassan Jameel', 'Sana Iqbal', 'Faisal Mehmood',
  'Amina Bibi', 'Zubair Khan', 'Nadia Perveen', 'Imran Hussain', 'Rabia Sultana',
  'Kashif Ali', 'Asma Khatoon', 'Waqar Ahmad', 'Sidra Batool', 'Tariq Mahmood',
  'Saima Jabeen', 'Nadeem Abbas', 'Uzma Rani', 'Shahzad Akram', 'Samina Yasmin'
];

const teacherNames = [
  'Dr. Ahmad Raza', 'Prof. Fatima Jinnah', 'Dr. Khalid Mahmood', 'Prof. Sadia Khan',
  'Dr. Imran Qureshi', 'Prof. Nadia Hussain', 'Dr. Zafar Iqbal', 'Prof. Ayesha Siddiqui',
  'Dr. Rashid Ali', 'Prof. Huma Nawaz', 'Dr. Sajid Mehmood', 'Prof. Bushra Ahmed',
  'Dr. Nasir Abbas', 'Prof. Rubina Bibi', 'Dr. Asif Shah'
];

async function clearExistingData() {
  console.log('🗑️  Clearing existing data...');
  
  // Clear in order due to foreign key constraints
  await prisma.logs.deleteMany({});
  await prisma.attendanceLog.deleteMany({});
  await prisma.activePresence.deleteMany({});
  await prisma.unknownFaces.deleteMany({});
  await prisma.faceEmbeddings.deleteMany({});
  await prisma.processedFaceImages.deleteMany({});
  await prisma.camara.deleteMany({});
  await prisma.students.deleteMany({});
  await prisma.teacher.deleteMany({});
  await prisma.zone.deleteMany({});
  
  console.log('✅ Existing data cleared');
}

async function createZones() {
  console.log('🏢 Creating zones...');
  
  const zones = [
    { Zone_Name: 'Main Entrance', Description: 'Primary building entrance with security checkpoint' },
    { Zone_Name: 'Computer Lab A', Description: 'Programming and software development lab' },
    { Zone_Name: 'Library', Description: 'Central library and study area' },
    { Zone_Name: 'Cafeteria', Description: 'Main dining and refreshment area' },
    { Zone_Name: 'Lecture Hall 1', Description: 'Large lecture hall for 200+ students' },
    { Zone_Name: 'Admin Block', Description: 'Administrative offices and staff rooms' }
  ];

  const createdZones = [];
  for (const zone of zones) {
    const created = await prisma.zone.create({ data: zone });
    createdZones.push(created);
  }
  
  console.log(`✅ Created ${createdZones.length} zones`);
  return createdZones;
}

async function createCameras(zones) {
  console.log('📹 Creating cameras...');
  
  const cameras = [];
  for (const zone of zones) {
    // Add 1-2 cameras per zone
    const numCameras = randomInt(1, 2);
    for (let i = 0; i < numCameras; i++) {
      const camera = await prisma.camara.create({
        data: {
          Zone_id: zone.Zone_id,
          Camera_Type: i === 0 ? 'Entry' : 'Exit',
          Camera_URL: `rtsp://admin:password@192.168.1.${100 + cameras.length}/stream`,
          Password: 'camera123'
        }
      });
      cameras.push(camera);
    }
  }
  
  console.log(`✅ Created ${cameras.length} cameras`);
  return cameras;
}

async function createStudents() {
  console.log('👨‍🎓 Creating students...');
  
  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const student = await prisma.students.create({
      data: {
        Name: studentNames[i],
        RollNumber: `2024-CS-${String(i + 1).padStart(3, '0')}`,
        Email: studentNames[i].toLowerCase().replace(' ', '.') + '@university.edu',
        Department: departments[randomInt(0, departments.length - 1)],
        Gender: genders[randomInt(0, 1)]
      }
    });
    students.push(student);
  }
  
  console.log(`✅ Created ${students.length} students`);
  return students;
}

async function createTeachers() {
  console.log('👨‍🏫 Creating teachers...');
  
  const teachers = [];
  for (let i = 0; i < teacherNames.length; i++) {
    const teacher = await prisma.teacher.create({
      data: {
        Name: teacherNames[i],
        Email: teacherNames[i].toLowerCase().replace(/[^a-z]/g, '.') + '@university.edu',
        Department: departments[randomInt(0, departments.length - 1)],
        Faculty_Type: facultyTypes[randomInt(0, facultyTypes.length - 1)],
        Gender: genders[randomInt(0, 1)]
      }
    });
    teachers.push(teacher);
  }
  
  console.log(`✅ Created ${teachers.length} teachers`);
  return teachers;
}

async function createAttendanceLogs(students, teachers, zones) {
  console.log('📊 Creating attendance logs (this may take a moment)...');
  
  const logs = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Create logs for the past 30 days
  for (let day = 0; day < 30; day++) {
    const date = new Date(thirtyDaysAgo.getTime() + day * 24 * 60 * 60 * 1000);
    
    // Skip weekends with lower probability
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend && Math.random() > 0.2) continue;
    
    // Number of entries per day (more on weekdays)
    const entriesPerDay = isWeekend ? randomInt(10, 30) : randomInt(50, 150);
    
    for (let entry = 0; entry < entriesPerDay; entry++) {
      // Randomly choose student or teacher
      const isStudent = Math.random() > 0.3;
      const person = isStudent 
        ? students[randomInt(0, students.length - 1)]
        : teachers[randomInt(0, teachers.length - 1)];
      
      const zone = zones[randomInt(0, zones.length - 1)];
      
      // Entry time between 7 AM and 6 PM
      const entryHour = randomInt(7, 18);
      const entryMinute = randomInt(0, 59);
      const entryTime = new Date(date);
      entryTime.setHours(entryHour, entryMinute, randomInt(0, 59));
      
      // Duration between 15 minutes and 6 hours
      const durationMinutes = randomInt(15, 360);
      const exitTime = new Date(entryTime.getTime() + durationMinutes * 60 * 1000);
      
      // Only add exit if it's not today (today's entries might still be active)
      const hasExit = day < 29 || Math.random() > 0.3;
      
      const logData = {
        PersonType: isStudent ? 'STUDENT' : 'TEACHER',
        Student_ID: isStudent ? person.Student_ID : null,
        Teacher_ID: isStudent ? null : person.Teacher_ID,
        Zone_id: zone.Zone_id,
        EntryTime: entryTime,
        ExitTime: hasExit ? exitTime : null,
        Duration: hasExit ? durationMinutes : null
      };
      
      try {
        const log = await prisma.attendanceLog.create({ data: logData });
        logs.push(log);
      } catch (err) {
        // Skip on constraint errors
      }
    }
    
    // Progress indicator
    if (day % 5 === 0) {
      process.stdout.write(`  Day ${day + 1}/30... `);
    }
  }
  
  console.log(`\n✅ Created ${logs.length} attendance logs`);
  return logs;
}

async function createActivePresence(students, teachers, zones) {
  console.log('🟢 Creating active presence records...');
  
  const presences = [];
  const now = new Date();
  
  // Add 10-20 people currently in various zones
  const numActive = randomInt(10, 20);
  
  for (let i = 0; i < numActive; i++) {
    const isStudent = Math.random() > 0.3;
    const person = isStudent 
      ? students[randomInt(0, students.length - 1)]
      : teachers[randomInt(0, teachers.length - 1)];
    
    const zone = zones[randomInt(0, zones.length - 1)];
    
    // Entry time in last 4 hours
    const entryTime = new Date(now.getTime() - randomInt(15, 240) * 60 * 1000);
    
    try {
      const presence = await prisma.activePresence.create({
        data: {
          PersonType: isStudent ? 'STUDENT' : 'TEACHER',
          Student_ID: isStudent ? person.Student_ID : null,
          Teacher_ID: isStudent ? null : person.Teacher_ID,
          Zone_id: zone.Zone_id,
          EntryTime: entryTime
        }
      });
      presences.push(presence);
    } catch (err) {
      // Skip duplicates
    }
  }
  
  console.log(`✅ Created ${presences.length} active presence records`);
  return presences;
}

async function createUnknownFaces(zones) {
  console.log('❓ Creating unknown face records...');
  
  const unknowns = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Create 20-40 unknown face detections over the past week
  const numUnknowns = randomInt(20, 40);
  
  for (let i = 0; i < numUnknowns; i++) {
    const detectedTime = randomDate(sevenDaysAgo, now);
    const zone = zones[randomInt(0, zones.length - 1)];
    
    const unknown = await prisma.unknownFaces.create({
      data: {
        Zone_id: zone.Zone_id,
        DetectedTime: detectedTime,
        Confidence: Math.random() * 0.4 + 0.3, // 30-70% confidence
        Status: ['PENDING', 'REVIEWED', 'IDENTIFIED'][randomInt(0, 2)],
        Notes: Math.random() > 0.7 ? 'Flagged for review' : null
      }
    });
    unknowns.push(unknown);
  }
  
  console.log(`✅ Created ${unknowns.length} unknown face records`);
  return unknowns;
}

async function createLogs(students, teachers, zones) {
  console.log('📝 Creating general logs...');
  
  const logs = [];
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  // Create additional logs for the Logs table
  const numLogs = randomInt(100, 200);
  
  for (let i = 0; i < numLogs; i++) {
    const isStudent = Math.random() > 0.3;
    const person = isStudent 
      ? students[randomInt(0, students.length - 1)]
      : teachers[randomInt(0, teachers.length - 1)];
    
    const zone = zones[randomInt(0, zones.length - 1)];
    const entryTime = randomDate(fourteenDaysAgo, now);
    
    // 80% have exit times
    const hasExit = Math.random() > 0.2;
    const exitTime = hasExit 
      ? new Date(entryTime.getTime() + randomInt(30, 300) * 60 * 1000)
      : null;
    
    const log = await prisma.logs.create({
      data: {
        PersonType: isStudent ? 'STUDENT' : 'TEACHER',
        Student_ID: isStudent ? person.Student_ID : null,
        Teacher_ID: isStudent ? null : person.Teacher_ID,
        Zone_id: zone.Zone_id,
        EntryTime: entryTime,
        ExitTime: exitTime
      }
    });
    logs.push(log);
  }
  
  console.log(`✅ Created ${logs.length} general logs`);
  return logs;
}

async function main() {
  console.log('\n🚀 Starting dummy data generation for charts...\n');
  console.log('=' .repeat(50));
  
  try {
    // Clear existing data
    await clearExistingData();
    
    console.log('\n📦 Creating new data...\n');
    
    // Create in order due to dependencies
    const zones = await createZones();
    const cameras = await createCameras(zones);
    const students = await createStudents();
    const teachers = await createTeachers();
    const attendanceLogs = await createAttendanceLogs(students, teachers, zones);
    const activePresence = await createActivePresence(students, teachers, zones);
    const unknownFaces = await createUnknownFaces(zones);
    const logs = await createLogs(students, teachers, zones);
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   • Zones: ${zones.length}`);
    console.log(`   • Cameras: ${cameras.length}`);
    console.log(`   • Students: ${students.length}`);
    console.log(`   • Teachers: ${teachers.length}`);
    console.log(`   • Attendance Logs: ${attendanceLogs.length}`);
    console.log(`   • Active Presence: ${activePresence.length}`);
    console.log(`   • Unknown Faces: ${unknownFaces.length}`);
    console.log(`   • General Logs: ${logs.length}`);
    
    console.log('\n✅ Dummy data generation complete!');
    console.log('🎉 You can now view the charts and graphs in the dashboard.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
