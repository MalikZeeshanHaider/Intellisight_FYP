-- CreateTable
CREATE TABLE "Admin" (
    "Admin_ID" SERIAL NOT NULL,
    "Name" TEXT,
    "Email" TEXT,
    "Password" TEXT,
    "Role" TEXT,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("Admin_ID")
);

-- CreateTable
CREATE TABLE "Zone" (
    "Zone_id" SERIAL NOT NULL,
    "Zone_Name" TEXT,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("Zone_id")
);

-- CreateTable
CREATE TABLE "Camara" (
    "Camara_Id" SERIAL NOT NULL,
    "Password" TEXT,
    "Zone_id" INTEGER,
    "Camera_Type" TEXT DEFAULT 'Entry',
    "Camera_URL" TEXT,

    CONSTRAINT "Camara_pkey" PRIMARY KEY ("Camara_Id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "Teacher_ID" SERIAL NOT NULL,
    "Name" TEXT,
    "Email" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Department" TEXT,
    "Face_Picture_1" TEXT,
    "Face_Picture_2" TEXT,
    "Face_Picture_3" TEXT,
    "Face_Picture_4" TEXT,
    "Face_Picture_5" TEXT,
    "Face_Embeddings" BYTEA,
    "Faculty_Type" TEXT,
    "Gender" TEXT,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("Teacher_ID")
);

-- CreateTable
CREATE TABLE "Students" (
    "Student_ID" SERIAL NOT NULL,
    "Name" TEXT,
    "RollNumber" TEXT,
    "Email" TEXT,
    "Face_Picture_1" TEXT,
    "Face_Picture_2" TEXT,
    "Face_Picture_3" TEXT,
    "Face_Picture_4" TEXT,
    "Face_Picture_5" TEXT,
    "Face_Embeddings" BYTEA,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "Department" TEXT,
    "Gender" TEXT,

    CONSTRAINT "Students_pkey" PRIMARY KEY ("Student_ID")
);

-- CreateTable
CREATE TABLE "TimeTable" (
    "TimeTable_ID" SERIAL NOT NULL,
    "EntryTime" TIMESTAMP(3),
    "ExitTime" TIMESTAMP(3),
    "PersonType" TEXT,
    "Admin_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Student_ID" INTEGER,
    "Zone_id" INTEGER,

    CONSTRAINT "TimeTable_pkey" PRIMARY KEY ("TimeTable_ID")
);

-- CreateTable
CREATE TABLE "UnknownFaces" (
    "Unknown_ID" SERIAL NOT NULL,
    "Captured_Image" BYTEA,
    "DetectedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Zone_id" INTEGER,
    "Confidence" DOUBLE PRECISION,
    "Status" TEXT DEFAULT 'PENDING',
    "Notes" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnknownFaces_pkey" PRIMARY KEY ("Unknown_ID")
);

-- CreateTable
CREATE TABLE "ActivePresence" (
    "Presence_ID" SERIAL NOT NULL,
    "PersonType" TEXT NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Zone_id" INTEGER NOT NULL,
    "EntryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivePresence_pkey" PRIMARY KEY ("Presence_ID")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "Log_ID" SERIAL NOT NULL,
    "PersonType" TEXT NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Zone_id" INTEGER NOT NULL,
    "EntryTime" TIMESTAMP(3) NOT NULL,
    "ExitTime" TIMESTAMP(3),
    "Duration" INTEGER,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("Log_ID")
);

-- CreateTable
CREATE TABLE "ProcessedFaceImages" (
    "Processed_ID" SERIAL NOT NULL,
    "PersonType" TEXT NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Image1" BYTEA,
    "Image2" BYTEA,
    "Image3" BYTEA,
    "Image4" BYTEA,
    "Image5" BYTEA,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedFaceImages_pkey" PRIMARY KEY ("Processed_ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_Email_key" ON "Admin"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_Email_key" ON "Teacher"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Students_RollNumber_key" ON "Students"("RollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Students_Email_key" ON "Students"("Email");

-- AddForeignKey
ALTER TABLE "Camara" ADD CONSTRAINT "Camara_Zone_id_fkey" FOREIGN KEY ("Zone_id") REFERENCES "Zone"("Zone_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTable" ADD CONSTRAINT "TimeTable_Admin_ID_fkey" FOREIGN KEY ("Admin_ID") REFERENCES "Admin"("Admin_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTable" ADD CONSTRAINT "TimeTable_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTable" ADD CONSTRAINT "TimeTable_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeTable" ADD CONSTRAINT "TimeTable_Zone_id_fkey" FOREIGN KEY ("Zone_id") REFERENCES "Zone"("Zone_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePresence" ADD CONSTRAINT "ActivePresence_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePresence" ADD CONSTRAINT "ActivePresence_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivePresence" ADD CONSTRAINT "ActivePresence_Zone_id_fkey" FOREIGN KEY ("Zone_id") REFERENCES "Zone"("Zone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_Zone_id_fkey" FOREIGN KEY ("Zone_id") REFERENCES "Zone"("Zone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedFaceImages" ADD CONSTRAINT "ProcessedFaceImages_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedFaceImages" ADD CONSTRAINT "ProcessedFaceImages_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE CASCADE ON UPDATE CASCADE;
