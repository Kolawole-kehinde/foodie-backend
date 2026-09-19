/*
  Warnings:

  - You are about to drop the column `verificationTokenExpiresAt` on the `PendingRegistration` table. All the data in the column will be lost.
  - You are about to drop the column `verificationTokenHash` on the `PendingRegistration` table. All the data in the column will be lost.
  - You are about to drop the `EmailVerificationToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailVerificationToken" DROP CONSTRAINT "EmailVerificationToken_userId_fkey";

-- DropIndex
DROP INDEX "PendingRegistration_verificationTokenExpiresAt_idx";

-- DropIndex
DROP INDEX "PendingRegistration_verificationTokenHash_key";

-- AlterTable
ALTER TABLE "PendingRegistration" DROP COLUMN "verificationTokenExpiresAt",
DROP COLUMN "verificationTokenHash";

-- DropTable
DROP TABLE "EmailVerificationToken";
