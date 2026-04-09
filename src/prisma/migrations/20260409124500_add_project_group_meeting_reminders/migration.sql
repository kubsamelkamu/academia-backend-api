-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'PROJECT_GROUP_MEETING_REMINDER_24H';
ALTER TYPE "NotificationEventType" ADD VALUE 'PROJECT_GROUP_MEETING_REMINDER_1H';

-- AlterTable
ALTER TABLE "project_group_meetings"
ADD COLUMN "reminder_24h_sent_at" TIMESTAMP(3),
ADD COLUMN "reminder_1h_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "project_group_meetings_reminder_24h_sent_at_idx" ON "project_group_meetings"("reminder_24h_sent_at");

-- CreateIndex
CREATE INDEX "project_group_meetings_reminder_1h_sent_at_idx" ON "project_group_meetings"("reminder_1h_sent_at");
