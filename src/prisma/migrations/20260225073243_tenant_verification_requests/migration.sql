-- CreateEnum
CREATE TYPE "TenantVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "tenant_verification_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "submitted_by_user_id" TEXT NOT NULL,
    "status" "TenantVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "document_url" TEXT NOT NULL,
    "document_public_id" TEXT NOT NULL,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_verification_requests_tenant_id_idx" ON "tenant_verification_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_verification_requests_status_idx" ON "tenant_verification_requests"("status");

-- CreateIndex
CREATE INDEX "tenant_verification_requests_submitted_by_user_id_idx" ON "tenant_verification_requests"("submitted_by_user_id");

-- CreateIndex
CREATE INDEX "tenant_verification_requests_reviewed_by_user_id_idx" ON "tenant_verification_requests"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "tenant_verification_requests_created_at_idx" ON "tenant_verification_requests"("created_at");

-- AddForeignKey
ALTER TABLE "tenant_verification_requests" ADD CONSTRAINT "tenant_verification_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_verification_requests" ADD CONSTRAINT "tenant_verification_requests_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_verification_requests" ADD CONSTRAINT "tenant_verification_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
