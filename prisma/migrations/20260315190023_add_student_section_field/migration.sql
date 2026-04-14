-- AlterTable
ALTER TABLE "Students" ADD COLUMN     "Section_ID" INTEGER;

-- AddForeignKey
ALTER TABLE "Students" ADD CONSTRAINT "Students_Section_ID_fkey" FOREIGN KEY ("Section_ID") REFERENCES "Section"("Section_ID") ON DELETE SET NULL ON UPDATE CASCADE;
