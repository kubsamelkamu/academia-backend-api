/*
  Warnings:

  - You are about to drop the `billing_admin_audits` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "billing_admin_audits";

-- CreateTable
CREATE TABLE "billing_admin_audit" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_admin_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_admin_audit_actor_user_id_idx" ON "billing_admin_audit"("actor_user_id");

-- CreateIndex
CREATE INDEX "billing_admin_audit_action_idx" ON "billing_admin_audit"("action");

-- CreateIndex
CREATE INDEX "billing_admin_audit_target_type_target_id_idx" ON "billing_admin_audit"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "billing_admin_audit_created_at_idx" ON "billing_admin_audit"("created_at");
