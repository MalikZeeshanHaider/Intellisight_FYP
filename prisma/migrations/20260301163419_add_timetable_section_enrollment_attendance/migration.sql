-- CreateTable
CREATE TABLE "Section" (
    "Section_ID" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Department" TEXT,
    "Semester" TEXT,
    "Shift" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("Section_ID")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "Enrollment_ID" SERIAL NOT NULL,
    "Section_ID" INTEGER NOT NULL,
    "Student_ID" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("Enrollment_ID")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "Slot_ID" SERIAL NOT NULL,
    "Section_ID" INTEGER NOT NULL,
    "Teacher_ID" INTEGER,
    "TeacherName" TEXT,
    "SubjectName" TEXT NOT NULL,
    "DayOfWeek" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Zone_id" INTEGER,
    "RoomName" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("Slot_ID")
);

-- CreateTable
CREATE TABLE "ClassAttendance" (
    "Attendance_ID" SERIAL NOT NULL,
    "Slot_ID" INTEGER NOT NULL,
    "Date" DATE NOT NULL,
    "PersonType" TEXT NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Status" TEXT NOT NULL DEFAULT 'ABSENT',
    "FirstSeenAt" TIMESTAMP(3),
    "LastSeenAt" TIMESTAMP(3),
    "TotalMinutes" INTEGER,
    "DetectionsCount" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAttendance_pkey" PRIMARY KEY ("Attendance_ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_Name_key" ON "Section"("Name");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_Section_ID_Student_ID_key" ON "Enrollment"("Section_ID", "Student_ID");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_Section_ID_DayOfWeek_StartTime_key" ON "TimetableSlot"("Section_ID", "DayOfWeek", "StartTime");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAttendance_Slot_ID_Date_Student_ID_key" ON "ClassAttendance"("Slot_ID", "Date", "Student_ID");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAttendance_Slot_ID_Date_Teacher_ID_key" ON "ClassAttendance"("Slot_ID", "Date", "Teacher_ID");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_Section_ID_fkey" FOREIGN KEY ("Section_ID") REFERENCES "Section"("Section_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_Section_ID_fkey" FOREIGN KEY ("Section_ID") REFERENCES "Section"("Section_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_Zone_id_fkey" FOREIGN KEY ("Zone_id") REFERENCES "Zone"("Zone_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_Slot_ID_fkey" FOREIGN KEY ("Slot_ID") REFERENCES "TimetableSlot"("Slot_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAttendance" ADD CONSTRAINT "ClassAttendance_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE CASCADE ON UPDATE CASCADE;
