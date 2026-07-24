-- AlterTable
ALTER TABLE "Epic" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sprintId" TEXT;

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Epic_sprintId_idx" ON "Epic"("sprintId");

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
