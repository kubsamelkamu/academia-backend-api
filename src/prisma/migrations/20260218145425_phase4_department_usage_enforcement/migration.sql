-- CreateTable
CREATE TABLE "department_usage" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "users_count" INTEGER NOT NULL DEFAULT 0,
    "projects_count" INTEGER NOT NULL DEFAULT 0,
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "email_sent_count" INTEGER NOT NULL DEFAULT 0,
    "report_exports_count" INTEGER NOT NULL DEFAULT 0,
    "api_calls_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_usage_department_id_idx" ON "department_usage"("department_id");

-- CreateIndex
CREATE INDEX "department_usage_period_start_period_end_idx" ON "department_usage"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "department_usage_department_id_period_start_period_end_key" ON "department_usage"("department_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "department_usage" ADD CONSTRAINT "department_usage_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
