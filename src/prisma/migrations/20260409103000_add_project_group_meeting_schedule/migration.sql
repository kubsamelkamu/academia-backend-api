-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'PROJECT_GROUP_MEETING_SCHEDULED';

-- CreateTable
CREATE TABLE "project_group_meetings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "meeting_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "agenda" VARCHAR(5000) NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_group_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_group_meetings_tenantId_departmentId_created_at_idx" ON "project_group_meetings"("tenantId", "departmentId", "created_at");

-- CreateIndex
CREATE INDEX "project_group_meetings_project_id_meeting_at_idx" ON "project_group_meetings"("project_id", "meeting_at");

-- CreateIndex
CREATE INDEX "project_group_meetings_project_group_id_meeting_at_idx" ON "project_group_meetings"("project_group_id", "meeting_at");

-- CreateIndex
CREATE INDEX "project_group_meetings_created_by_user_id_created_at_idx" ON "project_group_meetings"("created_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_group_meetings" ADD CONSTRAINT "project_group_meetings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_meetings" ADD CONSTRAINT "project_group_meetings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_meetings" ADD CONSTRAINT "project_group_meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_meetings" ADD CONSTRAINT "project_group_meetings_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_meetings" ADD CONSTRAINT "project_group_meetings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
