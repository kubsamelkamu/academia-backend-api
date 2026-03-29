-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "project_group_id" TEXT;

-- CreateIndex
CREATE INDEX "proposals_project_group_id_idx" ON "proposals"("project_group_id");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
