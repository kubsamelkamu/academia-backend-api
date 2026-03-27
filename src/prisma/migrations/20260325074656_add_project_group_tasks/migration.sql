-- CreateEnum
CREATE TYPE "ProjectGroupTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "project_group_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "project_group_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "description" VARCHAR(5000),
    "due_date" TIMESTAMP(3),
    "status" "ProjectGroupTaskStatus" NOT NULL DEFAULT 'TODO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_group_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_group_tasks_tenantId_project_group_id_idx" ON "project_group_tasks"("tenantId", "project_group_id");

-- CreateIndex
CREATE INDEX "project_group_tasks_project_group_id_status_idx" ON "project_group_tasks"("project_group_id", "status");

-- CreateIndex
CREATE INDEX "project_group_tasks_assigned_to_user_id_status_idx" ON "project_group_tasks"("assigned_to_user_id", "status");

-- CreateIndex
CREATE INDEX "project_group_tasks_created_at_idx" ON "project_group_tasks"("created_at");

-- AddForeignKey
ALTER TABLE "project_group_tasks" ADD CONSTRAINT "project_group_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_tasks" ADD CONSTRAINT "project_group_tasks_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_tasks" ADD CONSTRAINT "project_group_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_tasks" ADD CONSTRAINT "project_group_tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
