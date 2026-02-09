-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_years_tenant_id_idx" ON "academic_years"("tenant_id");

-- CreateIndex
CREATE INDEX "academic_years_is_active_idx" ON "academic_years"("is_active");

-- CreateIndex
CREATE INDEX "academic_years_start_date_end_date_idx" ON "academic_years"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_tenant_id_name_key" ON "academic_years"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
