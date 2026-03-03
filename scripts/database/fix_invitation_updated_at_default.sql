-- Align local DB with the modified migration (deploy-safe)
-- Ensures invitations.updated_at has a default, matching the migration file.
ALTER TABLE "invitations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
