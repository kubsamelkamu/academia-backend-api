-- CreateEnum
CREATE TYPE "ProjectGroupAnnouncementKind" AS ENUM ('GENERAL', 'PROPOSAL_REJECTION_REMINDER');

-- AlterTable
ALTER TABLE "project_group_announcements"
ADD COLUMN     "proposal_id" TEXT,
ADD COLUMN     "kind" "ProjectGroupAnnouncementKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "deadline_at" TIMESTAMP(3),
ADD COLUMN     "disable_after_deadline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expired_at" TIMESTAMP(3),
ADD COLUMN     "created_notification_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_24h_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_1h_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "project_group_announcements_proposal_id_idx" ON "project_group_announcements"("proposal_id");

-- CreateIndex
CREATE INDEX "project_group_announcements_deadline_at_idx" ON "project_group_announcements"("deadline_at");

-- CreateIndex
CREATE INDEX "project_group_announcements_expired_at_idx" ON "project_group_announcements"("expired_at");

-- AddForeignKey
ALTER TABLE "project_group_announcements" ADD CONSTRAINT "project_group_announcements_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;