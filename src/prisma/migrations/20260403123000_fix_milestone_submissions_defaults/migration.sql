-- Ensure milestone_submissions id + timestamps have safe defaults (align with Prisma schema expectations)

ALTER TABLE "milestone_submissions"
  ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text);

ALTER TABLE "milestone_submissions"
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
