-- CreateEnum
CREATE TYPE "ProjectGroupInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "project_group_invitations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "leader_user_id" TEXT NOT NULL,
    "invited_user_id" TEXT NOT NULL,
    "invited_email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "status" "ProjectGroupInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_group_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_group_invitations_token_key" ON "project_group_invitations"("token");

-- CreateIndex
CREATE INDEX "project_group_invitations_tenantId_departmentId_idx" ON "project_group_invitations"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_group_invitations_project_group_id_status_idx" ON "project_group_invitations"("project_group_id", "status");

-- CreateIndex
CREATE INDEX "project_group_invitations_invited_user_id_status_idx" ON "project_group_invitations"("invited_user_id", "status");

-- CreateIndex
CREATE INDEX "project_group_invitations_leader_user_id_status_idx" ON "project_group_invitations"("leader_user_id", "status");

-- CreateIndex
CREATE INDEX "project_group_invitations_expires_at_idx" ON "project_group_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "project_group_invitations_created_at_idx" ON "project_group_invitations"("created_at");

-- Add unique constraint: a user can only be a member of one group
CREATE UNIQUE INDEX "project_group_members_user_id_key" ON "project_group_members"("user_id");

-- AddForeignKey
ALTER TABLE "project_group_invitations" ADD CONSTRAINT "project_group_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_invitations" ADD CONSTRAINT "project_group_invitations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_invitations" ADD CONSTRAINT "project_group_invitations_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_invitations" ADD CONSTRAINT "project_group_invitations_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_invitations" ADD CONSTRAINT "project_group_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
