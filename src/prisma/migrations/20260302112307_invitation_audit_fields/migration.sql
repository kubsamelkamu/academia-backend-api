/*
  Warnings:

  - Added the required column `updated_at` to the `invitations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "last_send_error" VARCHAR(500),
ADD COLUMN     "last_sent_at" TIMESTAMP(3),
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "revoked_by_id" TEXT,
ADD COLUMN     "send_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- Backfill for existing rows (if any), then enforce NOT NULL.
UPDATE "invitations"
SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "updated_at" IS NULL;

ALTER TABLE "invitations" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "invitations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
