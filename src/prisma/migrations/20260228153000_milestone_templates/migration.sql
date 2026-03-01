-- CreateTable
CREATE TABLE "milestone_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_template_milestones" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "default_duration_days" INTEGER NOT NULL,
    "has_deliverable" BOOLEAN NOT NULL DEFAULT false,
    "required_documents" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_template_milestones_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "projects" ADD COLUMN "milestone_template_id" TEXT;

-- CreateIndex
CREATE INDEX "milestone_templates_tenantId_idx" ON "milestone_templates"("tenantId");

-- CreateIndex
CREATE INDEX "milestone_templates_departmentId_idx" ON "milestone_templates"("departmentId");

-- CreateIndex
CREATE INDEX "milestone_templates_is_active_idx" ON "milestone_templates"("is_active");

-- CreateIndex
CREATE INDEX "milestone_templates_created_at_idx" ON "milestone_templates"("created_at");

-- CreateIndex
CREATE INDEX "milestone_template_milestones_template_id_idx" ON "milestone_template_milestones"("template_id");

-- CreateIndex
CREATE INDEX "milestone_template_milestones_sequence_idx" ON "milestone_template_milestones"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_template_milestones_template_id_sequence_key" ON "milestone_template_milestones"("template_id", "sequence");

-- CreateIndex
CREATE INDEX "projects_milestone_template_id_idx" ON "projects"("milestone_template_id");

-- AddForeignKey
ALTER TABLE "milestone_templates" ADD CONSTRAINT "milestone_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_templates" ADD CONSTRAINT "milestone_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_templates" ADD CONSTRAINT "milestone_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_template_milestones" ADD CONSTRAINT "milestone_template_milestones_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "milestone_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_milestone_template_id_fkey" FOREIGN KEY ("milestone_template_id") REFERENCES "milestone_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
