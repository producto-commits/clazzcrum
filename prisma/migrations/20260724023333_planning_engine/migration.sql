-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "plannedEndAt" TIMESTAMP(3),
ADD COLUMN     "sprintLengthDays" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
ADD COLUMN     "weeklyHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "UserStory" ADD COLUMN     "planSprintId" TEXT;

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dedicationPct" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSprint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_userId_projectId_key" ON "ProjectAssignment"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSprint_projectId_index_key" ON "PlanSprint"("projectId", "index");

-- CreateIndex
CREATE INDEX "CapacityEvent_userId_date_idx" ON "CapacityEvent"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSprint" ADD CONSTRAINT "PlanSprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityEvent" ADD CONSTRAINT "CapacityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_planSprintId_fkey" FOREIGN KEY ("planSprintId") REFERENCES "PlanSprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
