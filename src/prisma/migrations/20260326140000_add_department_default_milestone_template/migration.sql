-- AddColumn
ALTER TABLE "departments" ADD COLUMN "default_milestone_template_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "departments_default_milestone_template_id_key" ON "departments"("default_milestone_template_id");

-- CreateIndex
CREATE INDEX "departments_default_milestone_template_id_idx" ON "departments"("default_milestone_template_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_default_milestone_template_id_fkey" FOREIGN KEY ("default_milestone_template_id") REFERENCES "milestone_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
