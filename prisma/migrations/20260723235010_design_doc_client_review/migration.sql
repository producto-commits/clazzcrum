-- AlterTable
ALTER TABLE "DesignDoc" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DesignDocComment" (
    "id" TEXT NOT NULL,
    "designDocId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignDocComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignDocComment_designDocId_idx" ON "DesignDocComment"("designDocId");

-- AddForeignKey
ALTER TABLE "DesignDocComment" ADD CONSTRAINT "DesignDocComment_designDocId_fkey" FOREIGN KEY ("designDocId") REFERENCES "DesignDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignDocComment" ADD CONSTRAINT "DesignDocComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
