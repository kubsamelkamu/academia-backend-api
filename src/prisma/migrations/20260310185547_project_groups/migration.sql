-- CreateTable
CREATE TABLE "project_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "leader_user_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "objectives" VARCHAR(2000),
    "technologies" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_groups_leader_user_id_key" ON "project_groups"("leader_user_id");

-- CreateIndex
CREATE INDEX "project_groups_tenantId_departmentId_idx" ON "project_groups"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "project_groups_tenantId_leader_user_id_idx" ON "project_groups"("tenantId", "leader_user_id");

-- CreateIndex
CREATE INDEX "project_groups_created_at_idx" ON "project_groups"("created_at");

-- AddForeignKey
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
