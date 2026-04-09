-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'PROJECT_GROUP_MEETING_UPDATED';
ALTER TYPE "NotificationEventType" ADD VALUE 'PROJECT_GROUP_MEETING_CANCELLED';

-- AlterTable
ALTER TABLE "project_group_meetings"
ADD COLUMN "cancellation_reason" VARCHAR(1000),
ADD COLUMN "cancelled_at" TIMESTAMP(3),
ADD COLUMN "cancelled_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "project_group_meetings_cancelled_at_idx" ON "project_group_meetings"("cancelled_at");

-- CreateIndex
CREATE INDEX "project_group_meetings_cancelled_by_user_id_idx" ON "project_group_meetings"("cancelled_by_user_id");

-- AddForeignKey
ALTER TABLE "project_group_meetings" ADD CONSTRAINT "project_group_meetings_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
