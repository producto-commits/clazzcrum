-- Bloqueos con motivo y días acumulados
ALTER TABLE "UserStory" ADD COLUMN "blockReason" TEXT;
ALTER TABLE "UserStory" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "UserStory" ADD COLUMN "blockedDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
-- Consecutivo de tickets (001, 002…)
ALTER TABLE "Ticket" ADD COLUMN "number" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");
-- Tipo de documento (design | manual | tests | delivery)
ALTER TABLE "DesignDoc" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'design';
