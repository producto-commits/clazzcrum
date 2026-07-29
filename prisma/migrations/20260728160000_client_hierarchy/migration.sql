-- Jerarquía de clientes: un cliente puede pertenecer a otro (padre).
-- Al borrar el padre, los hijos quedan a nivel raíz (parentId = NULL).

ALTER TABLE "Client" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Client_parentId_idx" ON "Client"("parentId");
