-- CreateEnum
CREATE TYPE "ProjectGroupJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "project_group_join_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "leader_user_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "message" VARCHAR(1000),
    "status" "ProjectGroupJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" TEXT,
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_group_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_group_join_requests_tenantId_departmentId_idx" ON "project_group_join_requests"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_group_join_requests_project_group_id_status_idx" ON "project_group_join_requests"("project_group_id", "status");

-- CreateIndex
CREATE INDEX "project_group_join_requests_requested_by_user_id_status_idx" ON "project_group_join_requests"("requested_by_user_id", "status");

-- CreateIndex
CREATE INDEX "project_group_join_requests_leader_user_id_status_idx" ON "project_group_join_requests"("leader_user_id", "status");

-- CreateIndex
CREATE INDEX "project_group_join_requests_created_at_idx" ON "project_group_join_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_group_join_requests_project_group_id_requested_by_u_key" ON "project_group_join_requests"("project_group_id", "requested_by_user_id");

-- AddForeignKey
ALTER TABLE "project_group_join_requests" ADD CONSTRAINT "project_group_join_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_join_requests" ADD CONSTRAINT "project_group_join_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_join_requests" ADD CONSTRAINT "project_group_join_requests_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_join_requests" ADD CONSTRAINT "project_group_join_requests_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_join_requests" ADD CONSTRAINT "project_group_join_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_join_requests" ADD CONSTRAINT "project_group_join_requests_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
