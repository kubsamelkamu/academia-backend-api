-- CreateEnum
CREATE TYPE "GroupLeaderRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "group_leader_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "status" "GroupLeaderRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_leader_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_leader_requests_studentUserId_key" ON "group_leader_requests"("studentUserId");

-- CreateIndex
CREATE INDEX "group_leader_requests_tenantId_departmentId_status_idx" ON "group_leader_requests"("tenantId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "group_leader_requests_tenantId_status_idx" ON "group_leader_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "group_leader_requests_departmentId_status_idx" ON "group_leader_requests"("departmentId", "status");

-- CreateIndex
CREATE INDEX "group_leader_requests_created_at_idx" ON "group_leader_requests"("created_at");

-- AddForeignKey
ALTER TABLE "group_leader_requests" ADD CONSTRAINT "group_leader_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_leader_requests" ADD CONSTRAINT "group_leader_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_leader_requests" ADD CONSTRAINT "group_leader_requests_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_leader_requests" ADD CONSTRAINT "group_leader_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
