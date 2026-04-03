-- CreateEnum
CREATE TYPE "MilestoneSubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "milestone_submissions" (
  "id" TEXT NOT NULL,
  "milestone_id" TEXT NOT NULL,
  "uploaded_by_user_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_public_id" TEXT NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL DEFAULT 'raw',
    "status" "MilestoneSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "approved_by_user_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_submissions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "milestone_submissions_milestone_id_created_at_idx" ON "milestone_submissions"("milestone_id", "created_at");
CREATE INDEX "milestone_submissions_uploaded_by_user_id_idx" ON "milestone_submissions"("uploaded_by_user_id");
CREATE INDEX "milestone_submissions_approved_by_user_id_idx" ON "milestone_submissions"("approved_by_user_id");

-- Foreign Keys
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigger to keep updated_at fresh (matches existing patterns where @updatedAt is used)
CREATE OR REPLACE FUNCTION set_updated_at_milestone_submissions()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_milestone_submissions ON "milestone_submissions";
CREATE TRIGGER trg_set_updated_at_milestone_submissions
BEFORE UPDATE ON "milestone_submissions"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_milestone_submissions();
