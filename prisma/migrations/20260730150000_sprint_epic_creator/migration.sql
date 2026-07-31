-- Guardar quién creó cada hito y cada fase para que el creador (developer)
-- siempre pueda verlos aunque aún no tenga actividades propias en ellos.

ALTER TABLE "Sprint" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Sprint"
  ADD CONSTRAINT "Sprint_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sprint_createdById_idx" ON "Sprint"("createdById");

ALTER TABLE "Epic" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Epic"
  ADD CONSTRAINT "Epic_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Epic_createdById_idx" ON "Epic"("createdById");
