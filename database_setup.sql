-- =====================================================
-- IntelliSight Database Setup
-- PostgreSQL Database Schema
-- Generated from Prisma Schema
-- =====================================================

-- Drop existing tables if they exist (in correct order to handle foreign keys)
DROP TABLE IF EXISTS "TimeTable" CASCADE;
DROP TABLE IF EXISTS "Students" CASCADE;
DROP TABLE IF EXISTS "Teacher" CASCADE;
DROP TABLE IF EXISTS "Camara" CASCADE;
DROP TABLE IF EXISTS "Admin" CASCADE;
DROP TABLE IF EXISTS "Zone" CASCADE;

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Admin Table
CREATE TABLE "Admin" (
    "Admin_ID" SERIAL PRIMARY KEY,
    "Name" VARCHAR(255),
    "Email" VARCHAR(255),
    "Password" VARCHAR(255),
    "Role" VARCHAR(100)
);

-- Zone Table
CREATE TABLE "Zone" (
    "Zone_id" SERIAL PRIMARY KEY,
    "Zone_Name" VARCHAR(255)
);

-- Camara Table
CREATE TABLE "Camara" (
    "Camara_Id" SERIAL PRIMARY KEY,
    "Password" VARCHAR(255),
    "Zone_id" INTEGER,
    CONSTRAINT "fk_camara_zone" 
        FOREIGN KEY ("Zone_id") 
        REFERENCES "Zone"("Zone_id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Teacher Table
CREATE TABLE "Teacher" (
    "Teacher_ID" SERIAL PRIMARY KEY,
    "Name" VARCHAR(255),
    "Face_Pictures" BYTEA,
    "Email" VARCHAR(255),
    "Camara_Id" INTEGER,
    "Zone_id" INTEGER,
    CONSTRAINT "fk_teacher_camara" 
        FOREIGN KEY ("Camara_Id") 
        REFERENCES "Camara"("Camara_Id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT "fk_teacher_zone" 
        FOREIGN KEY ("Zone_id") 
        REFERENCES "Zone"("Zone_id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- Students Table
CREATE TABLE "Students" (
    "Student_ID" SERIAL PRIMARY KEY,
    "Name" VARCHAR(255),
    "Face_Pictures" BYTEA,
    "Email" VARCHAR(255),
    "Camara_Id" INTEGER,
    "Zone_id" INTEGER,
    CONSTRAINT "fk_students_camara" 
        FOREIGN KEY ("Camara_Id") 
        REFERENCES "Camara"("Camara_Id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT "fk_students_zone" 
        FOREIGN KEY ("Zone_id") 
        REFERENCES "Zone"("Zone_id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- TimeTable Table
CREATE TABLE "TimeTable" (
    "TimeTable_ID" SERIAL PRIMARY KEY,
    "EntryTime" TIMESTAMP,
    "ExitTime" TIMESTAMP,
    "PersonType" VARCHAR(50),
    "Admin_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Student_ID" INTEGER,
    "Zone_id" INTEGER,
    CONSTRAINT "fk_timetable_admin" 
        FOREIGN KEY ("Admin_ID") 
        REFERENCES "Admin"("Admin_ID") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT "fk_timetable_teacher" 
        FOREIGN KEY ("Teacher_ID") 
        REFERENCES "Teacher"("Teacher_ID") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT "fk_timetable_student" 
        FOREIGN KEY ("Student_ID") 
        REFERENCES "Students"("Student_ID") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT "fk_timetable_zone" 
        FOREIGN KEY ("Zone_id") 
        REFERENCES "Zone"("Zone_id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- =====================================================
-- CREATE INDEXES (Optional - for better performance)
-- =====================================================

CREATE INDEX idx_camara_zone ON "Camara"("Zone_id");
CREATE INDEX idx_teacher_camara ON "Teacher"("Camara_Id");
CREATE INDEX idx_teacher_zone ON "Teacher"("Zone_id");
CREATE INDEX idx_students_camara ON "Students"("Camara_Id");
CREATE INDEX idx_students_zone ON "Students"("Zone_id");
CREATE INDEX idx_timetable_admin ON "TimeTable"("Admin_ID");
CREATE INDEX idx_timetable_teacher ON "TimeTable"("Teacher_ID");
CREATE INDEX idx_timetable_student ON "TimeTable"("Student_ID");
CREATE INDEX idx_timetable_zone ON "TimeTable"("Zone_id");
CREATE INDEX idx_timetable_persontype ON "TimeTable"("PersonType");

-- =====================================================
-- SAMPLE INSERT STATEMENTS
-- =====================================================

-- Insert Admin records
INSERT INTO "Admin" ("Name", "Email", "Password", "Role") VALUES
('John Administrator', 'john.admin@intellisight.com', 'hashed_password_123', 'Super Admin'),
('Sarah Manager', 'sarah.manager@intellisight.com', 'hashed_password_456', 'Manager'),
('Mike Coordinator', 'mike.coord@intellisight.com', 'hashed_password_789', 'Coordinator');

-- Insert Zone records
INSERT INTO "Zone" ("Zone_Name") VALUES
('Main Building - Floor 1'),
('Main Building - Floor 2'),
('Science Lab Block'),
('Library Zone'),
('Cafeteria Area');

-- Insert Camara records
INSERT INTO "Camara" ("Password", "Zone_id") VALUES
('cam_pass_001', 1),
('cam_pass_002', 1),
('cam_pass_003', 2),
('cam_pass_004', 3),
('cam_pass_005', 4),
('cam_pass_006', 5);

-- Insert Teacher records
INSERT INTO "Teacher" ("Name", "Email", "Camara_Id", "Zone_id") VALUES
('Dr. Emma Watson', 'emma.watson@intellisight.edu', 1, 1),
('Prof. Robert Johnson', 'robert.johnson@intellisight.edu', 3, 2),
('Dr. Lisa Chen', 'lisa.chen@intellisight.edu', 4, 3),
('Prof. David Miller', 'david.miller@intellisight.edu', 5, 4),
('Dr. Sophia Martinez', 'sophia.martinez@intellisight.edu', 2, 1);

-- Insert Students records
INSERT INTO "Students" ("Name", "Email", "Camara_Id", "Zone_id") VALUES
('Alice Williams', 'alice.w@student.intellisight.edu', 1, 1),
('Bob Taylor', 'bob.t@student.intellisight.edu', 1, 1),
('Charlie Brown', 'charlie.b@student.intellisight.edu', 3, 2),
('Diana Prince', 'diana.p@student.intellisight.edu', 4, 3),
('Edward Norton', 'edward.n@student.intellisight.edu', 5, 4),
('Fiona Green', 'fiona.g@student.intellisight.edu', 2, 1),
('George Harris', 'george.h@student.intellisight.edu', 3, 2),
('Hannah Lee', 'hannah.l@student.intellisight.edu', 6, 5);

-- Insert TimeTable records (Entry/Exit logs)
INSERT INTO "TimeTable" ("EntryTime", "ExitTime", "PersonType", "Admin_ID", "Teacher_ID", "Student_ID", "Zone_id") VALUES
-- Teacher entries
(CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '30 minutes', 'TEACHER', 1, 1, NULL, 1),
(CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL, 'TEACHER', 1, 2, NULL, 2),
(CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '15 minutes', 'TEACHER', 2, 3, NULL, 3),

-- Student entries
(CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour', 'STUDENT', 1, NULL, 1, 1),
(CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL, 'STUDENT', 1, NULL, 2, 1),
(CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours', 'STUDENT', 2, NULL, 3, 2),
(CURRENT_TIMESTAMP - INTERVAL '2 hours', NULL, 'STUDENT', 2, NULL, 4, 3),
(CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '10 minutes', 'STUDENT', 3, NULL, 5, 4),
(CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '3 hours', 'STUDENT', 1, NULL, 6, 1),
(CURRENT_TIMESTAMP - INTERVAL '4 hours', NULL, 'STUDENT', 2, NULL, 7, 2);

-- =====================================================
-- BASIC SELECT QUERIES (CRUD Testing)
-- =====================================================

-- ========== READ (SELECT) QUERIES ==========

-- 1. Get all admins
SELECT * FROM "Admin";

-- 2. Get all zones
SELECT * FROM "Zone";

-- 3. Get all cameras with their zone names
SELECT 
    c."Camara_Id",
    c."Password",
    z."Zone_Name"
FROM "Camara" c
LEFT JOIN "Zone" z ON c."Zone_id" = z."Zone_id";

-- 4. Get all teachers with their zone and camera information
SELECT 
    t."Teacher_ID",
    t."Name",
    t."Email",
    z."Zone_Name",
    c."Camara_Id"
FROM "Teacher" t
LEFT JOIN "Zone" z ON t."Zone_id" = z."Zone_id"
LEFT JOIN "Camara" c ON t."Camara_Id" = c."Camara_Id";

-- 5. Get all students with their zone and camera information
SELECT 
    s."Student_ID",
    s."Name",
    s."Email",
    z."Zone_Name",
    c."Camara_Id"
FROM "Students" s
LEFT JOIN "Zone" z ON s."Zone_id" = z."Zone_id"
LEFT JOIN "Camara" c ON s."Camara_Id" = c."Camara_Id";

-- 6. Get all timetable entries with complete information
SELECT 
    tt."TimeTable_ID",
    tt."EntryTime",
    tt."ExitTime",
    tt."PersonType",
    a."Name" AS "Admin_Name",
    t."Name" AS "Teacher_Name",
    s."Name" AS "Student_Name",
    z."Zone_Name"
FROM "TimeTable" tt
LEFT JOIN "Admin" a ON tt."Admin_ID" = a."Admin_ID"
LEFT JOIN "Teacher" t ON tt."Teacher_ID" = t."Teacher_ID"
LEFT JOIN "Students" s ON tt."Student_ID" = s."Student_ID"
LEFT JOIN "Zone" z ON tt."Zone_id" = z."Zone_id"
ORDER BY tt."EntryTime" DESC;

-- 7. Get currently active users (no exit time)
SELECT 
    tt."TimeTable_ID",
    tt."EntryTime",
    tt."PersonType",
    COALESCE(t."Name", s."Name") AS "Person_Name",
    z."Zone_Name"
FROM "TimeTable" tt
LEFT JOIN "Teacher" t ON tt."Teacher_ID" = t."Teacher_ID"
LEFT JOIN "Students" s ON tt."Student_ID" = s."Student_ID"
LEFT JOIN "Zone" z ON tt."Zone_id" = z."Zone_id"
WHERE tt."ExitTime" IS NULL
ORDER BY tt."EntryTime" DESC;

-- 8. Count students per zone
SELECT 
    z."Zone_Name",
    COUNT(s."Student_ID") AS "Student_Count"
FROM "Zone" z
LEFT JOIN "Students" s ON z."Zone_id" = s."Zone_id"
GROUP BY z."Zone_id", z."Zone_Name"
ORDER BY "Student_Count" DESC;

-- 9. Count teachers per zone
SELECT 
    z."Zone_Name",
    COUNT(t."Teacher_ID") AS "Teacher_Count"
FROM "Zone" z
LEFT JOIN "Teacher" t ON z."Zone_id" = t."Zone_id"
GROUP BY z."Zone_id", z."Zone_Name"
ORDER BY "Teacher_Count" DESC;

-- 10. Get entry/exit logs for today
SELECT 
    tt."TimeTable_ID",
    tt."EntryTime",
    tt."ExitTime",
    tt."PersonType",
    COALESCE(t."Name", s."Name") AS "Person_Name",
    z."Zone_Name"
FROM "TimeTable" tt
LEFT JOIN "Teacher" t ON tt."Teacher_ID" = t."Teacher_ID"
LEFT JOIN "Students" s ON tt."Student_ID" = s."Student_ID"
LEFT JOIN "Zone" z ON tt."Zone_id" = z."Zone_id"
WHERE DATE(tt."EntryTime") = CURRENT_DATE
ORDER BY tt."EntryTime" DESC;

-- ========== UPDATE QUERIES ==========

-- Update admin information
-- UPDATE "Admin" 
-- SET "Email" = 'new.email@intellisight.com', "Role" = 'Senior Admin'
-- WHERE "Admin_ID" = 1;

-- Update zone name
-- UPDATE "Zone" 
-- SET "Zone_Name" = 'Main Building - Ground Floor'
-- WHERE "Zone_id" = 1;

-- Update teacher information
-- UPDATE "Teacher" 
-- SET "Email" = 'new.emma@intellisight.edu', "Zone_id" = 2
-- WHERE "Teacher_ID" = 1;

-- Update student information
-- UPDATE "Students" 
-- SET "Email" = 'new.alice@student.intellisight.edu', "Zone_id" = 2
-- WHERE "Student_ID" = 1;

-- Record exit time for a timetable entry
-- UPDATE "TimeTable" 
-- SET "ExitTime" = CURRENT_TIMESTAMP
-- WHERE "TimeTable_ID" = 2 AND "ExitTime" IS NULL;

-- ========== DELETE QUERIES ==========

-- Delete a specific timetable entry
-- DELETE FROM "TimeTable" WHERE "TimeTable_ID" = 1;

-- Delete a student
-- DELETE FROM "Students" WHERE "Student_ID" = 1;

-- Delete a teacher
-- DELETE FROM "Teacher" WHERE "Teacher_ID" = 1;

-- Delete a camera
-- DELETE FROM "Camara" WHERE "Camara_Id" = 1;

-- Delete a zone (will cascade to related records if configured)
-- DELETE FROM "Zone" WHERE "Zone_id" = 1;

-- Delete an admin
-- DELETE FROM "Admin" WHERE "Admin_ID" = 1;

-- =====================================================
-- USEFUL UTILITY QUERIES
-- =====================================================

-- Check database structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- =====================================================
-- END OF SQL SCRIPT
-- =====================================================
/*
select * from "ActivePresence";
select * from "Admin";
select * from "AttendanceLog";
select * from "Camara";
select * from "FaceEmbeddings";
select * from "Logs";
select * from "ProcessedFaceImages";
select * from "Students";
select * from "Teacher";
select * from "ActivePresence";
select * from "UnknownFaces";
select * from "Zone";
select * from "_prisma_migrations";
*/