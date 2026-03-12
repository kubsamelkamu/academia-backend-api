-- AlterTable
ALTER TABLE "project_groups" ADD COLUMN     "rejection_reason" VARCHAR(500),
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
