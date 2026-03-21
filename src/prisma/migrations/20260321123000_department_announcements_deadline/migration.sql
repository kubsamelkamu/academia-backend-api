-- CreateEnum
CREATE TYPE "DepartmentAnnouncementActionType" AS ENUM (
    'FORM_PROJECT_GROUP',
    'SUBMIT_PROPOSAL',
    'UPLOAD_DOCUMENT',
    'REGISTER_PRESENTATION',
    'CUSTOM_ACTION'
);

-- CreateTable
CREATE TABLE "department_announcements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" VARCHAR(5000) NOT NULL,
    "action_type" "DepartmentAnnouncementActionType" NOT NULL,
    "action_label" VARCHAR(120),
    "action_url" TEXT,
    "deadline_at" TIMESTAMP(3),
    "disable_after_deadline" BOOLEAN NOT NULL DEFAULT true,
    "expired_at" TIMESTAMP(3),
    "created_notification_sent_at" TIMESTAMP(3),
    "reminder_24h_sent_at" TIMESTAMP(3),
    "reminder_1h_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_announcements_tenantId_departmentId_created_at_idx" ON "department_announcements"("tenantId", "departmentId", "created_at");

-- CreateIndex
CREATE INDEX "department_announcements_departmentId_created_at_idx" ON "department_announcements"("departmentId", "created_at");

-- CreateIndex
CREATE INDEX "department_announcements_created_by_user_id_idx" ON "department_announcements"("created_by_user_id");

-- CreateIndex
CREATE INDEX "department_announcements_deadline_at_idx" ON "department_announcements"("deadline_at");

-- CreateIndex
CREATE INDEX "department_announcements_expired_at_idx" ON "department_announcements"("expired_at");

-- AddForeignKey
ALTER TABLE "department_announcements" ADD CONSTRAINT "department_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_announcements" ADD CONSTRAINT "department_announcements_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_announcements" ADD CONSTRAINT "department_announcements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend notification event enum for department announcement lifecycle
ALTER TYPE "NotificationEventType" ADD VALUE 'DEPARTMENT_ANNOUNCEMENT_CREATED';
ALTER TYPE "NotificationEventType" ADD VALUE 'DEPARTMENT_ANNOUNCEMENT_DEADLINE_24H';
ALTER TYPE "NotificationEventType" ADD VALUE 'DEPARTMENT_ANNOUNCEMENT_DEADLINE_1H';
ALTER TYPE "NotificationEventType" ADD VALUE 'DEPARTMENT_ANNOUNCEMENT_DEADLINE_PASSED';
