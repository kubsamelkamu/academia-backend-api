-- CreateTable
CREATE TABLE "billing_admin_audits" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "department_id" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_admin_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_admin_audits_tenant_id_department_id_idx" ON "billing_admin_audits"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "billing_admin_audits_actor_user_id_idx" ON "billing_admin_audits"("actor_user_id");

-- CreateIndex
CREATE INDEX "billing_admin_audits_action_idx" ON "billing_admin_audits"("action");

-- CreateIndex
CREATE INDEX "billing_admin_audits_created_at_idx" ON "billing_admin_audits"("created_at");
