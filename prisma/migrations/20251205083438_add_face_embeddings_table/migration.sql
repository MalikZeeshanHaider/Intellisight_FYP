/*
  Warnings:

  - You are about to drop the `TimeTable` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TimeTable" DROP CONSTRAINT "TimeTable_Admin_ID_fkey";

-- DropForeignKey
ALTER TABLE "TimeTable" DROP CONSTRAINT "TimeTable_Student_ID_fkey";

-- DropForeignKey
ALTER TABLE "TimeTable" DROP CONSTRAINT "TimeTable_Teacher_ID_fkey";

-- DropForeignKey
ALTER TABLE "TimeTable" DROP CONSTRAINT "TimeTable_Zone_id_fkey";

-- DropTable
DROP TABLE "TimeTable";

-- CreateTable
CREATE TABLE "FaceEmbeddings" (
    "Embedding_ID" SERIAL NOT NULL,
    "PersonType" TEXT NOT NULL,
    "Student_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "PersonName" TEXT,
    "ImagePath" TEXT,
    "Embedding" BYTEA NOT NULL,
    "EmbeddingJson" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaceEmbeddings_pkey" PRIMARY KEY ("Embedding_ID")
);

-- CreateTable
CREATE TABLE "Logs" (
    "Logs_ID" SERIAL NOT NULL,
    "EntryTime" TIMESTAMP(3),
    "ExitTime" TIMESTAMP(3),
    "PersonType" TEXT,
    "Admin_ID" INTEGER,
    "Teacher_ID" INTEGER,
    "Student_ID" INTEGER,
    "Zone_id" INTEGER,

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("Logs_ID")
);

-- AddForeignKey
ALTER TABLE "FaceEmbeddings" ADD CONSTRAINT "FaceEmbeddings_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEmbeddings" ADD CONSTRAINT "FaceEmbeddings_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_Admin_ID_fkey" FOREIGN KEY ("Admin_ID") REFERENCES "Admin"("Admin_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_Student_ID_fkey" FOREIGN KEY ("Student_ID") REFERENCES "Students"("Student_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_Teacher_ID_fkey" FOREIGN KEY ("Teacher_ID") REFERENCES "Teacher"("Teacher_ID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_Zone_id_fkey" FOREIGN KEY ("Zone_id") REFERENCES "Zone"("Zone_id") ON DELETE SET NULL ON UPDATE CASCADE;
