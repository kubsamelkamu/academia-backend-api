-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('SRS', 'SDD', 'REPORT', 'OTHER');

-- CreateTable
CREATE TABLE "department_document_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL DEFAULT 'OTHER',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_document_template_files" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_public_id" TEXT NOT NULL,
    "resource_type" VARCHAR(20) NOT NULL DEFAULT 'raw',
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_document_template_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_document_templates_tenantId_idx" ON "department_document_templates"("tenantId");

-- CreateIndex
CREATE INDEX "department_document_templates_departmentId_idx" ON "department_document_templates"("departmentId");

-- CreateIndex
CREATE INDEX "department_document_templates_type_idx" ON "department_document_templates"("type");

-- CreateIndex
CREATE INDEX "department_document_templates_is_active_idx" ON "department_document_templates"("is_active");

-- CreateIndex
CREATE INDEX "department_document_templates_created_at_idx" ON "department_document_templates"("created_at");

-- CreateIndex
CREATE INDEX "department_document_template_files_template_id_idx" ON "department_document_template_files"("template_id");

-- CreateIndex
CREATE INDEX "department_document_template_files_uploaded_by_idx" ON "department_document_template_files"("uploaded_by");

-- AddForeignKey
ALTER TABLE "department_document_templates" ADD CONSTRAINT "department_document_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_document_templates" ADD CONSTRAINT "department_document_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_document_templates" ADD CONSTRAINT "department_document_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_document_template_files" ADD CONSTRAINT "department_document_template_files_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "department_document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_document_template_files" ADD CONSTRAINT "department_document_template_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
