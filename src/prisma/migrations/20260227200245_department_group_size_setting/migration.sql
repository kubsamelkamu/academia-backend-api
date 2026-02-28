-- CreateTable
CREATE TABLE "department_group_size_settings" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "minGroupSize" INTEGER NOT NULL DEFAULT 2,
    "maxGroupSize" INTEGER NOT NULL DEFAULT 6,
    "createdById" TEXT,
    "updatedById" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_group_size_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_group_size_settings_departmentId_idx" ON "department_group_size_settings"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "department_group_size_settings_departmentId_key" ON "department_group_size_settings"("departmentId");

-- AddForeignKey
ALTER TABLE "department_group_size_settings" ADD CONSTRAINT "department_group_size_settings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_group_size_settings" ADD CONSTRAINT "department_group_size_settings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_group_size_settings" ADD CONSTRAINT "department_group_size_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
