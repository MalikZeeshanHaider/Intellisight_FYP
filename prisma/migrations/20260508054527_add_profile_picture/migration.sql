-- DropIndex
DROP INDEX "idx_faceembeddings_notcentroid";

-- AlterTable
ALTER TABLE "Students" ADD COLUMN     "Profile_Picture" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "Profile_Picture" TEXT;
