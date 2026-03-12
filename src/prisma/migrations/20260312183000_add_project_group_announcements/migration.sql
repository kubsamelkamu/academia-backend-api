-- CreateEnum
CREATE TYPE "ProjectGroupAnnouncementPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProjectGroupAnnouncementAttachmentType" AS ENUM ('NONE', 'FILE', 'LINK');

-- CreateEnum
CREATE TYPE "ProjectGroupAnnouncementAttachmentResourceType" AS ENUM ('image', 'raw');

-- CreateTable
CREATE TABLE "project_group_announcements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "priority" "ProjectGroupAnnouncementPriority" NOT NULL DEFAULT 'MEDIUM',
    "message" VARCHAR(5000) NOT NULL,
    "attachment_type" "ProjectGroupAnnouncementAttachmentType" NOT NULL DEFAULT 'NONE',
    "attachment_url" TEXT,
    "attachment_public_id" TEXT,
    "attachment_resource_type" "ProjectGroupAnnouncementAttachmentResourceType",
    "attachment_file_name" TEXT,
    "attachment_mime_type" TEXT,
    "attachment_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_group_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_group_announcements_tenantId_departmentId_idx" ON "project_group_announcements"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_group_announcements_project_group_id_created_at_idx" ON "project_group_announcements"("project_group_id", "created_at");

-- CreateIndex
CREATE INDEX "project_group_announcements_created_by_user_id_idx" ON "project_group_announcements"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "project_group_announcements" ADD CONSTRAINT "project_group_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_announcements" ADD CONSTRAINT "project_group_announcements_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_announcements" ADD CONSTRAINT "project_group_announcements_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_announcements" ADD CONSTRAINT "project_group_announcements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
