-- CreateTable
CREATE TABLE "email_verification_otps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "user_id" TEXT,
    "otp_hash" VARCHAR(255) NOT NULL,
    "otp_salt" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_otps_tenant_id_email_idx" ON "email_verification_otps"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "email_verification_otps_user_id_idx" ON "email_verification_otps"("user_id");

-- CreateIndex
CREATE INDEX "email_verification_otps_expires_at_idx" ON "email_verification_otps"("expires_at");

-- CreateIndex
CREATE INDEX "email_verification_otps_used_at_idx" ON "email_verification_otps"("used_at");

-- CreateIndex
CREATE INDEX "email_verification_otps_locked_until_idx" ON "email_verification_otps"("locked_until");

-- AddForeignKey
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
