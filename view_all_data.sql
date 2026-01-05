-- ====================================================
-- IntelliSight - Quick Database View Queries
-- Run these queries in pgAdmin or psql to view your data
-- ====================================================

-- Connection Info:
-- Host: localhost
-- Port: 5000
-- Database: FYP_Intellisight
-- User: postgres
-- Password: ozair

-- ====================================================
-- 1. VIEW ALL TABLES
-- ====================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ====================================================
-- 2. COUNT ALL RECORDS
-- ====================================================
SELECT 
  'Admin' as table_name, 
  COUNT(*) as count 
FROM "Admin"
UNION ALL
SELECT 'Teacher', COUNT(*) FROM "Teacher"
UNION ALL
SELECT 'Students', COUNT(*) FROM "Students"
UNION ALL
SELECT 'Zone', COUNT(*) FROM "Zone"
UNION ALL
SELECT 'Camara', COUNT(*) FROM "Camara"
UNION ALL
SELECT 'AttendanceLog', COUNT(*) FROM "AttendanceLog"
UNION ALL
SELECT 'ActivePresence', COUNT(*) FROM "ActivePresence"
UNION ALL
SELECT 'ProcessedFaceImages', COUNT(*) FROM "ProcessedFaceImages"
UNION ALL
SELECT 'FaceEmbeddings', COUNT(*) FROM "FaceEmbeddings"
UNION ALL
SELECT 'UnknownFaces', COUNT(*) FROM "UnknownFaces";

-- ====================================================
-- 3. VIEW ALL ADMINS
-- ====================================================
SELECT 
  "Admin_ID", 
  "Name", 
  "Email", 
  "Role",
  "created_at"
FROM "Admin"
ORDER BY "Admin_ID";

-- ====================================================
-- 4. VIEW ALL TEACHERS
-- ====================================================
SELECT 
  "Teacher_ID", 
  "Name", 
  "Email",
  "Zone_id",
  "Camara_Id",
  "created_at"
FROM "Teacher"
ORDER BY "Teacher_ID";

-- ====================================================
-- 5. VIEW ALL STUDENTS
-- ====================================================
SELECT 
  "Student_ID", 
  "Name", 
  "Email",
  "Zone_id",
  "Camara_Id",
  "created_at"
FROM "Students"
ORDER BY "Student_ID";

-- ====================================================
-- 6. VIEW ALL ZONES
-- ====================================================
SELECT 
  "Zone_id", 
  "Zone_Name",
  "created_at"
FROM "Zone"
ORDER BY "Zone_id";

-- ====================================================
-- 7. VIEW ALL CAMERAS WITH ZONES
-- ====================================================
SELECT 
  c."Camara_Id",
  c."CameraURL",
  c."Zone_id",
  z."Zone_Name",
  c."created_at"
FROM "Camara" c
LEFT JOIN "Zone" z ON c."Zone_id" = z."Zone_id"
ORDER BY c."Camara_Id";

-- ====================================================
-- 8. VIEW TEACHERS WITH THEIR ZONES
-- ====================================================
SELECT 
  t."Teacher_ID",
  t."Name" as "Teacher_Name",
  t."Email",
  z."Zone_Name",
  t."created_at"
FROM "Teacher" t
LEFT JOIN "Zone" z ON t."Zone_id" = z."Zone_id"
ORDER BY t."Teacher_ID";

-- ====================================================
-- 9. VIEW STUDENTS WITH THEIR ZONES
-- ====================================================
SELECT 
  s."Student_ID",
  s."Name" as "Student_Name",
  s."Email",
  z."Zone_Name",
  s."created_at"
FROM "Students" s
LEFT JOIN "Zone" z ON s."Zone_id" = z."Zone_id"
ORDER BY s."Student_ID";

-- ====================================================
-- 10. VIEW RECENT ATTENDANCE LOGS (Last 20)
-- ====================================================
SELECT 
  a."AttendanceLog_ID",
  a."person_type",
  a."person_id",
  a."Zone_id",
  z."Zone_Name",
  a."entry_time",
  a."confidence"
FROM "AttendanceLog" a
LEFT JOIN "Zone" z ON a."Zone_id" = z."Zone_id"
ORDER BY a."entry_time" DESC
LIMIT 20;

-- ====================================================
-- 11. VIEW CURRENT ACTIVE PRESENCE
-- ====================================================
SELECT 
  ap."person_type",
  ap."person_id",
  ap."Zone_id",
  z."Zone_Name",
  ap."entry_time",
  CASE 
    WHEN ap."person_type" = 'teacher' THEN t."Name"
    WHEN ap."person_type" = 'student' THEN s."Name"
  END as "Person_Name"
FROM "ActivePresence" ap
LEFT JOIN "Zone" z ON ap."Zone_id" = z."Zone_id"
LEFT JOIN "Teacher" t ON ap."person_type" = 'teacher' AND ap."person_id" = t."Teacher_ID"
LEFT JOIN "Students" s ON ap."person_type" = 'student' AND ap."person_id" = s."Student_ID"
ORDER BY ap."entry_time" DESC;

-- ====================================================
-- 12. VIEW PROCESSED FACE IMAGES
-- ====================================================
SELECT 
  pfi."Processed_ID",
  pfi."PersonType",
  pfi."Student_ID",
  pfi."Teacher_ID",
  CASE 
    WHEN pfi."PersonType" = 'teacher' THEN t."Name"
    WHEN pfi."PersonType" = 'student' THEN s."Name"
  END as "Person_Name",
  CASE WHEN pfi."Image1" IS NOT NULL THEN '✓' ELSE '✗' END as "Has_Image1",
  CASE WHEN pfi."Image2" IS NOT NULL THEN '✓' ELSE '✗' END as "Has_Image2",
  CASE WHEN pfi."Image3" IS NOT NULL THEN '✓' ELSE '✗' END as "Has_Image3",
  CASE WHEN pfi."Image4" IS NOT NULL THEN '✓' ELSE '✗' END as "Has_Image4",
  CASE WHEN pfi."Image5" IS NOT NULL THEN '✓' ELSE '✗' END as "Has_Image5",
  pfi."CreatedAt"
FROM "ProcessedFaceImages" pfi
LEFT JOIN "Teacher" t ON pfi."PersonType" = 'teacher' AND pfi."Teacher_ID" = t."Teacher_ID"
LEFT JOIN "Students" s ON pfi."PersonType" = 'student' AND pfi."Student_ID" = s."Student_ID"
ORDER BY pfi."CreatedAt" DESC;

-- ====================================================
-- 13. ATTENDANCE STATISTICS BY ZONE (TODAY)
-- ====================================================
SELECT 
  z."Zone_Name",
  COUNT(DISTINCT CASE WHEN a."person_type" = 'teacher' THEN a."person_id" END) as "Teachers_Today",
  COUNT(DISTINCT CASE WHEN a."person_type" = 'student' THEN a."person_id" END) as "Students_Today",
  COUNT(*) as "Total_Entries_Today"
FROM "AttendanceLog" a
LEFT JOIN "Zone" z ON a."Zone_id" = z."Zone_id"
WHERE DATE(a."entry_time") = CURRENT_DATE
GROUP BY z."Zone_id", z."Zone_Name"
ORDER BY "Total_Entries_Today" DESC;

-- ====================================================
-- 14. ATTENDANCE STATISTICS BY DATE (Last 7 Days)
-- ====================================================
SELECT 
  DATE(a."entry_time") as "Date",
  COUNT(DISTINCT CASE WHEN a."person_type" = 'teacher' THEN a."person_id" END) as "Unique_Teachers",
  COUNT(DISTINCT CASE WHEN a."person_type" = 'student' THEN a."person_id" END) as "Unique_Students",
  COUNT(*) as "Total_Entries"
FROM "AttendanceLog" a
WHERE a."entry_time" >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(a."entry_time")
ORDER BY "Date" DESC;

-- ====================================================
-- 15. UNKNOWN FACES DETECTED
-- ====================================================
SELECT 
  "UnknownFace_ID",
  "Zone_id",
  "detection_time",
  "confidence"
FROM "UnknownFaces"
ORDER BY "detection_time" DESC
LIMIT 20;

-- ====================================================
-- 16. ZONES WITH THEIR CAMERAS COUNT
-- ====================================================
SELECT 
  z."Zone_id",
  z."Zone_Name",
  COUNT(c."Camara_Id") as "Camera_Count"
FROM "Zone" z
LEFT JOIN "Camara" c ON z."Zone_id" = c."Zone_id"
GROUP BY z."Zone_id", z."Zone_Name"
ORDER BY z."Zone_id";

-- ====================================================
-- 17. PEOPLE BY ZONE
-- ====================================================
SELECT 
  z."Zone_Name",
  COUNT(DISTINCT t."Teacher_ID") as "Teachers_Assigned",
  COUNT(DISTINCT s."Student_ID") as "Students_Assigned"
FROM "Zone" z
LEFT JOIN "Teacher" t ON z."Zone_id" = t."Zone_id"
LEFT JOIN "Students" s ON z."Zone_id" = s."Zone_id"
GROUP BY z."Zone_id", z."Zone_Name"
ORDER BY z."Zone_id";

-- ====================================================
-- END OF QUERIES
-- ====================================================

-- Quick Access Queries (Copy and paste these in psql):
-- SELECT * FROM "Admin";
-- SELECT * FROM "Teacher";
-- SELECT * FROM "Students";
-- SELECT * FROM "Zone";
-- SELECT * FROM "Camara";
-- SELECT * FROM "AttendanceLog" ORDER BY "entry_time" DESC LIMIT 10;
-- SELECT * FROM "ActivePresence";
