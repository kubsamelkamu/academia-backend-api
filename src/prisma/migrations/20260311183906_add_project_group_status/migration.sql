-- CreateEnum
CREATE TYPE "ProjectGroupStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "project_groups" ADD COLUMN     "status" "ProjectGroupStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "project_groups_tenantId_departmentId_status_idx" ON "project_groups"("tenantId", "departmentId", "status");
