-- CreateTable
CREATE TABLE "invitation_message_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "department_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(200),
    "message" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitation_message_templates_tenantId_department_id_name_key" ON "invitation_message_templates"("tenantId", "department_id", "name");

-- CreateIndex
CREATE INDEX "invitation_message_templates_tenantId_idx" ON "invitation_message_templates"("tenantId");

-- CreateIndex
CREATE INDEX "invitation_message_templates_department_id_idx" ON "invitation_message_templates"("department_id");

-- CreateIndex
CREATE INDEX "invitation_message_templates_created_by_id_idx" ON "invitation_message_templates"("created_by_id");

-- AddForeignKey
ALTER TABLE "invitation_message_templates" ADD CONSTRAINT "invitation_message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_message_templates" ADD CONSTRAINT "invitation_message_templates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_message_templates" ADD CONSTRAINT "invitation_message_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
