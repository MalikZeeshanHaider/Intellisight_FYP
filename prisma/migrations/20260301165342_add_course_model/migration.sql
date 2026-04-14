-- AlterTable
ALTER TABLE "TimetableSlot" ADD COLUMN     "Course_ID" INTEGER;

-- CreateTable
CREATE TABLE "Course" (
    "Course_ID" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Code" TEXT NOT NULL,
    "CreditHours" INTEGER,
    "Department" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("Course_ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_Code_key" ON "Course"("Code");

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_Course_ID_fkey" FOREIGN KEY ("Course_ID") REFERENCES "Course"("Course_ID") ON DELETE SET NULL ON UPDATE CASCADE;
