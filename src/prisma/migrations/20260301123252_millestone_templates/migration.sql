-- DropForeignKey
ALTER TABLE "department_document_templates" DROP CONSTRAINT "department_document_templates_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "department_document_templates" DROP CONSTRAINT "department_document_templates_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "milestone_templates" DROP CONSTRAINT "milestone_templates_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "milestone_templates" DROP CONSTRAINT "milestone_templates_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "milestone_templates" ADD CONSTRAINT "milestone_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_templates" ADD CONSTRAINT "milestone_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_document_templates" ADD CONSTRAINT "department_document_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_document_templates" ADD CONSTRAINT "department_document_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
