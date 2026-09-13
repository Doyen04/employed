/*
  Warnings:

  - The primary key for the `Diagnostic` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `firstReported` on the `Diagnostic` table. All the data in the column will be lost.
  - You are about to drop the column `lastReported` on the `Diagnostic` table. All the data in the column will be lost.
  - The required column `id` was added to the `Diagnostic` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Diagnostic" DROP CONSTRAINT "Diagnostic_pkey",
DROP COLUMN "firstReported",
DROP COLUMN "lastReported",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Diagnostic_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Diagnostic_severity_createdAt_idx" ON "Diagnostic"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "Diagnostic_key_idx" ON "Diagnostic"("key");
