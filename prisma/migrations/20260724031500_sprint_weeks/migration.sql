-- Sprints de lunes a domingo: la duración pasa de días hábiles a SEMANAS.
ALTER TABLE "Project" RENAME COLUMN "sprintLengthDays" TO "sprintWeeks";
UPDATE "Project" SET "sprintWeeks" = GREATEST(1, ROUND("sprintWeeks" / 5.0));
ALTER TABLE "Project" ALTER COLUMN "sprintWeeks" SET DEFAULT 2;
