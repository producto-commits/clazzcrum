-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "inProgressAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TicketWorkLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketWorkLog_ticketId_idx" ON "TicketWorkLog"("ticketId");

-- CreateIndex
CREATE INDEX "TicketWorkLog_userId_idx" ON "TicketWorkLog"("userId");

-- AddForeignKey
ALTER TABLE "TicketWorkLog" ADD CONSTRAINT "TicketWorkLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWorkLog" ADD CONSTRAINT "TicketWorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
