-- Add Department.defaultMilestoneTemplateId (Postgres)

ALTER TABLE "departments"
ADD COLUMN IF NOT EXISTS "default_milestone_template_id" UUID;

-- Match Prisma @unique
CREATE UNIQUE INDEX IF NOT EXISTS "departments_default_milestone_template_id_key"
ON "departments" ("default_milestone_template_id");

-- Match Prisma @@index([defaultMilestoneTemplateId])
CREATE INDEX IF NOT EXISTS "departments_default_milestone_template_id_idx"
ON "departments" ("default_milestone_template_id");

-- Foreign key to milestone_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'departments_default_milestone_template_id_fkey'
  ) THEN
    ALTER TABLE "departments"
    ADD CONSTRAINT "departments_default_milestone_template_id_fkey"
    FOREIGN KEY ("default_milestone_template_id")
    REFERENCES "milestone_templates"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
