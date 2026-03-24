-- CreateEnum
CREATE TYPE "AdvisorProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'PENDING_REVIEW', 'CLEARED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "ProjectClearanceStatus" AS ENUM ('READY_FOR_CLEARANCE', 'CLEARED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "ProjectMilestonePriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProjectDocumentStatus" AS ENUM ('APPROVED', 'PENDING_REVIEW', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "ProjectDocumentType" AS ENUM ('PDF', 'DOCX', 'IMAGE', 'VIDEO', 'ZIP', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectMeetingType" AS ENUM ('VIRTUAL', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "ProjectMeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectEvaluationStatus" AS ENUM ('PENDING_REVIEW', 'EVALUATED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "ProjectEvaluationPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProjectRevisionRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AdvisorAnnouncementPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AdvisorAnnouncementStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvisorAnnouncementAudience" AS ENUM ('ALL', 'STUDENTS', 'ADVISORS');

-- CreateEnum
CREATE TYPE "AdvisorMessageGroupPrivacy" AS ENUM ('PRIVATE', 'PROJECT');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "advisor_status" "AdvisorProjectStatus",
ADD COLUMN     "category" VARCHAR(120),
ADD COLUMN     "clearance_notes" VARCHAR(5000),
ADD COLUMN     "clearance_status" "ProjectClearanceStatus",
ADD COLUMN     "cleared_at" TIMESTAMP(3),
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "group_name" VARCHAR(255),
ADD COLUMN     "progress_percent" INTEGER,
ADD COLUMN     "project_type" VARCHAR(120),
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "technologies" JSONB;

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "deliverables" JSONB,
ADD COLUMN     "priority" "ProjectMilestonePriority" DEFAULT 'MEDIUM';

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(5000),
    "type" "ProjectDocumentType" NOT NULL DEFAULT 'OTHER',
    "status" "ProjectDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "file_url" TEXT NOT NULL,
    "file_public_id" TEXT NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL DEFAULT 'raw',
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "feedback" VARCHAR(5000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_meetings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "type" "ProjectMeetingType" NOT NULL DEFAULT 'VIRTUAL',
    "location" VARCHAR(255),
    "agenda" VARCHAR(5000),
    "status" "ProjectMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attendees" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_evaluations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "student_user_id" TEXT,
    "status" "ProjectEvaluationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "priority" "ProjectEvaluationPriority" NOT NULL DEFAULT 'MEDIUM',
    "project_type" VARCHAR(120),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "summary" VARCHAR(5000),
    "rubric" JSONB,
    "attachments" JSONB,
    "feedback" VARCHAR(5000),
    "grade" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_revision_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "document_id" TEXT,
    "evaluation_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "feedback" VARCHAR(5000) NOT NULL,
    "status" "ProjectRevisionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_announcements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" VARCHAR(5000) NOT NULL,
    "priority" "AdvisorAnnouncementPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AdvisorAnnouncementStatus" NOT NULL DEFAULT 'PUBLISHED',
    "audience" "AdvisorAnnouncementAudience" NOT NULL DEFAULT 'STUDENTS',
    "deadline_at" TIMESTAMP(3),
    "target_project_ids" JSONB,
    "attachment_url" TEXT,
    "attachment_public_id" TEXT,
    "attachment_resource_type" VARCHAR(20),
    "attachment_file_name" TEXT,
    "attachment_mime_type" TEXT,
    "attachment_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_message_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000),
    "privacy" "AdvisorMessageGroupPrivacy" NOT NULL DEFAULT 'PRIVATE',
    "member_user_ids" JSONB NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_message_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "content" VARCHAR(5000) NOT NULL,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_documents_tenantId_departmentId_idx" ON "project_documents"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_documents_project_id_status_idx" ON "project_documents"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_documents_milestone_id_idx" ON "project_documents"("milestone_id");

-- CreateIndex
CREATE INDEX "project_documents_uploaded_by_user_id_idx" ON "project_documents"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "project_documents_reviewed_by_user_id_idx" ON "project_documents"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "project_documents_created_at_idx" ON "project_documents"("created_at");

-- CreateIndex
CREATE INDEX "project_meetings_tenantId_departmentId_idx" ON "project_meetings"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_meetings_project_id_scheduled_at_idx" ON "project_meetings"("project_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "project_meetings_advisor_user_id_scheduled_at_idx" ON "project_meetings"("advisor_user_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "project_meetings_status_idx" ON "project_meetings"("status");

-- CreateIndex
CREATE INDEX "project_evaluations_tenantId_departmentId_idx" ON "project_evaluations"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_evaluations_project_id_status_idx" ON "project_evaluations"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_evaluations_advisor_user_id_status_idx" ON "project_evaluations"("advisor_user_id", "status");

-- CreateIndex
CREATE INDEX "project_evaluations_student_user_id_idx" ON "project_evaluations"("student_user_id");

-- CreateIndex
CREATE INDEX "project_evaluations_due_date_idx" ON "project_evaluations"("due_date");

-- CreateIndex
CREATE INDEX "project_evaluations_submitted_at_idx" ON "project_evaluations"("submitted_at");

-- CreateIndex
CREATE INDEX "project_revision_requests_tenantId_departmentId_idx" ON "project_revision_requests"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_revision_requests_project_id_status_idx" ON "project_revision_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_revision_requests_milestone_id_idx" ON "project_revision_requests"("milestone_id");

-- CreateIndex
CREATE INDEX "project_revision_requests_document_id_idx" ON "project_revision_requests"("document_id");

-- CreateIndex
CREATE INDEX "project_revision_requests_evaluation_id_idx" ON "project_revision_requests"("evaluation_id");

-- CreateIndex
CREATE INDEX "project_revision_requests_created_by_user_id_idx" ON "project_revision_requests"("created_by_user_id");

-- CreateIndex
CREATE INDEX "project_revision_requests_created_at_idx" ON "project_revision_requests"("created_at");

-- CreateIndex
CREATE INDEX "advisor_announcements_tenantId_departmentId_idx" ON "advisor_announcements"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "advisor_announcements_advisor_user_id_created_at_idx" ON "advisor_announcements"("advisor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "advisor_announcements_status_idx" ON "advisor_announcements"("status");

-- CreateIndex
CREATE INDEX "advisor_announcements_deadline_at_idx" ON "advisor_announcements"("deadline_at");

-- CreateIndex
CREATE INDEX "advisor_message_groups_tenantId_departmentId_idx" ON "advisor_message_groups"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "advisor_message_groups_advisor_user_id_created_at_idx" ON "advisor_message_groups"("advisor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "advisor_message_groups_project_id_idx" ON "advisor_message_groups"("project_id");

-- CreateIndex
CREATE INDEX "advisor_message_groups_last_message_at_idx" ON "advisor_message_groups"("last_message_at");

-- CreateIndex
CREATE INDEX "advisor_messages_tenantId_departmentId_idx" ON "advisor_messages"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "advisor_messages_group_id_created_at_idx" ON "advisor_messages"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "advisor_messages_sender_user_id_created_at_idx" ON "advisor_messages"("sender_user_id", "created_at");

-- CreateIndex
CREATE INDEX "projects_advisor_status_idx" ON "projects"("advisor_status");

-- CreateIndex
CREATE INDEX "projects_clearance_status_idx" ON "projects"("clearance_status");

-- CreateIndex
CREATE INDEX "projects_due_date_idx" ON "projects"("due_date");

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_evaluations" ADD CONSTRAINT "project_evaluations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_evaluations" ADD CONSTRAINT "project_evaluations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_evaluations" ADD CONSTRAINT "project_evaluations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_evaluations" ADD CONSTRAINT "project_evaluations_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_evaluations" ADD CONSTRAINT "project_evaluations_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "project_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_revision_requests" ADD CONSTRAINT "project_revision_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_announcements" ADD CONSTRAINT "advisor_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_announcements" ADD CONSTRAINT "advisor_announcements_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_announcements" ADD CONSTRAINT "advisor_announcements_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_message_groups" ADD CONSTRAINT "advisor_message_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_message_groups" ADD CONSTRAINT "advisor_message_groups_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_message_groups" ADD CONSTRAINT "advisor_message_groups_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_message_groups" ADD CONSTRAINT "advisor_message_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "advisor_message_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
