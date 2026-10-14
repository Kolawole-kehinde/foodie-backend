-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'IDENTITY_EMAIL_VERIFICATION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'IDENTITY_EMAIL_VERIFICATION_RESENT';
ALTER TYPE "NotificationType" ADD VALUE 'IDENTITY_EMAIL_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'IDENTITY_PASSWORD_RESET_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'IDENTITY_PASSWORD_RESET_COMPLETED';
