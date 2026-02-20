/*
  Warnings:

  - You are about to drop the `billing_admin_audit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `billing_webhook_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_usage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscription_plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenant_subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "department_subscriptions" DROP CONSTRAINT "department_subscriptions_department_id_fkey";

-- DropForeignKey
ALTER TABLE "department_subscriptions" DROP CONSTRAINT "department_subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "department_usage" DROP CONSTRAINT "department_usage_department_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_subscriptions" DROP CONSTRAINT "tenant_subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_subscriptions" DROP CONSTRAINT "tenant_subscriptions_tenantId_fkey";

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "department_id" TEXT;

-- DropTable
DROP TABLE "billing_admin_audit";

-- DropTable
DROP TABLE "billing_webhook_events";

-- DropTable
DROP TABLE "department_subscriptions";

-- DropTable
DROP TABLE "department_usage";

-- DropTable
DROP TABLE "subscription_plans";

-- DropTable
DROP TABLE "tenant_subscriptions";

-- CreateIndex
CREATE INDEX "invitations_department_id_idx" ON "invitations"("department_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
