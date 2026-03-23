-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEventType" ADD VALUE 'PROPOSAL_SUBMITTED';
ALTER TYPE "NotificationEventType" ADD VALUE 'PROPOSAL_APPROVED';
ALTER TYPE "NotificationEventType" ADD VALUE 'PROPOSAL_REJECTED';

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "proposed_titles" JSONB,
ADD COLUMN     "selected_title_index" INTEGER;
