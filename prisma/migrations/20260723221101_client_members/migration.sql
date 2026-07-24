/*
  Warnings:

  - You are about to drop the column `userId` on the `Client` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_userId_fkey";

-- DropIndex
DROP INDEX "Client_userId_key";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
