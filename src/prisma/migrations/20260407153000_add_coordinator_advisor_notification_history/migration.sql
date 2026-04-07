-- CreateEnum
CREATE TYPE "CoordinatorAdvisorNotificationRecipientMode" AS ENUM ('SINGLE', 'MULTIPLE', 'ALL');

-- CreateEnum
CREATE TYPE "CoordinatorAdvisorNotificationDeliveryMethod" AS ENUM ('IN_APP', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "CoordinatorAdvisorNotificationInAppStatus" AS ENUM ('NOT_REQUESTED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "CoordinatorAdvisorNotificationEmailStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'ACCEPTED', 'DELIVERED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'COORDINATOR_ADVISOR_NOTIFICATION';

-- CreateTable
CREATE TABLE "coordinator_advisor_notification_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "recipient_mode" "CoordinatorAdvisorNotificationRecipientMode" NOT NULL,
    "delivery_method" "CoordinatorAdvisorNotificationDeliveryMethod" NOT NULL,
    "priority" "NotificationSeverity" NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "requested_recipients_count" INTEGER NOT NULL DEFAULT 0,
    "in_app_delivered_count" INTEGER NOT NULL DEFAULT 0,
    "in_app_failed_count" INTEGER NOT NULL DEFAULT 0,
    "email_queued_count" INTEGER NOT NULL DEFAULT 0,
    "email_accepted_count" INTEGER NOT NULL DEFAULT 0,
    "email_delivered_count" INTEGER NOT NULL DEFAULT 0,
    "email_failed_count" INTEGER NOT NULL DEFAULT 0,
    "total_reached_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordinator_advisor_notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordinator_advisor_notification_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "in_app_status" "CoordinatorAdvisorNotificationInAppStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "email_status" "CoordinatorAdvisorNotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "in_app_notification_id" TEXT,
    "email_provider_message_id" VARCHAR(255),
    "email_failure_reason" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordinator_advisor_notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coordinator_advisor_notification_campaigns_tenantId_departm_idx" ON "coordinator_advisor_notification_campaigns"("tenantId", "department_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_notification_campaigns_created_by_user__idx" ON "coordinator_advisor_notification_campaigns"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_notification_recipients_tenantId_depart_idx" ON "coordinator_advisor_notification_recipients"("tenantId", "department_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_notification_recipients_advisor_user_id_idx" ON "coordinator_advisor_notification_recipients"("advisor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_advisor_notification_recipients_in_app_notifica_idx" ON "coordinator_advisor_notification_recipients"("in_app_notification_id");

-- CreateIndex
CREATE INDEX "coordinator_advisor_notification_recipients_email_provider__idx" ON "coordinator_advisor_notification_recipients"("email_provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_advisor_notification_recipients_campaign_id_adv_key" ON "coordinator_advisor_notification_recipients"("campaign_id", "advisor_user_id");

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_campaigns" ADD CONSTRAINT "coordinator_advisor_notification_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_campaigns" ADD CONSTRAINT "coordinator_advisor_notification_campaigns_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_campaigns" ADD CONSTRAINT "coordinator_advisor_notification_campaigns_created_by_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_recipients" ADD CONSTRAINT "coordinator_advisor_notification_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "coordinator_advisor_notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_recipients" ADD CONSTRAINT "coordinator_advisor_notification_recipients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_recipients" ADD CONSTRAINT "coordinator_advisor_notification_recipients_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_recipients" ADD CONSTRAINT "coordinator_advisor_notification_recipients_advisor_user_i_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_advisor_notification_recipients" ADD CONSTRAINT "coordinator_advisor_notification_recipients_in_app_notific_fkey" FOREIGN KEY ("in_app_notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;