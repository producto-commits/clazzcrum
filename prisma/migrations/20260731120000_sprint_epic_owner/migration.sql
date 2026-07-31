-- Encargado (owner) del hito y de la fase — normalmente el dueño del proyecto
-- (developer/tech_lead con mayor dedicación). Distinto de createdById (audit).

ALTER TABLE "Sprint" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Sprint"
  ADD CONSTRAINT "Sprint_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sprint_ownerId_idx" ON "Sprint"("ownerId");

ALTER TABLE "Epic" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Epic"
  ADD CONSTRAINT "Epic_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Epic_ownerId_idx" ON "Epic"("ownerId");
