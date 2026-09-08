-- Fechas ancladas manualmente: el motor de planificación no las toca cuando es true.
ALTER TABLE "UserStory" ADD COLUMN "datesLocked" BOOLEAN NOT NULL DEFAULT false;
