ALTER TYPE "NotificationEventType" ADD VALUE 'COORDINATOR_EVALUATOR_NOTIFICATION';

CREATE TYPE "CoordinatorEvaluatorNotificationRecipientMode" AS ENUM ('SINGLE', 'MULTIPLE', 'ALL');
CREATE TYPE "CoordinatorEvaluatorNotificationDeliveryMethod" AS ENUM ('IN_APP', 'EMAIL', 'BOTH');
CREATE TYPE "CoordinatorEvaluatorNotificationInAppStatus" AS ENUM ('NOT_REQUESTED', 'DELIVERED', 'FAILED');
CREATE TYPE "CoordinatorEvaluatorNotificationEmailStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'ACCEPTED', 'DELIVERED', 'FAILED');

CREATE TABLE "coordinator_evaluator_notification_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "stage" "EvaluationStage" NOT NULL,
    "recipient_mode" "CoordinatorEvaluatorNotificationRecipientMode" NOT NULL,
    "delivery_method" "CoordinatorEvaluatorNotificationDeliveryMethod" NOT NULL,
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

    CONSTRAINT "coordinator_evaluator_notification_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coordinator_evaluator_notification_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "evaluator_user_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "in_app_status" "CoordinatorEvaluatorNotificationInAppStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "email_status" "CoordinatorEvaluatorNotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "in_app_notification_id" TEXT,
    "email_provider_message_id" VARCHAR(255),
    "email_failure_reason" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordinator_evaluator_notification_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coordinator_evaluator_notification_recipients_campaign_id_evaluator_user_id_key" ON "coordinator_evaluator_notification_recipients"("campaign_id", "evaluator_user_id");
CREATE INDEX "coordinator_evaluator_notification_campaigns_tenantId_department_id_stage_created_at_idx" ON "coordinator_evaluator_notification_campaigns"("tenantId", "department_id", "stage", "created_at");
CREATE INDEX "coordinator_evaluator_notification_campaigns_created_by_user_id_created_at_idx" ON "coordinator_evaluator_notification_campaigns"("created_by_user_id", "created_at");
CREATE INDEX "coordinator_evaluator_notification_recipients_tenantId_department_id_created_at_idx" ON "coordinator_evaluator_notification_recipients"("tenantId", "department_id", "created_at");
CREATE INDEX "coordinator_evaluator_notification_recipients_evaluator_user_id_created_at_idx" ON "coordinator_evaluator_notification_recipients"("evaluator_user_id", "created_at");
CREATE INDEX "coordinator_evaluator_notification_recipients_in_app_notification_id_idx" ON "coordinator_evaluator_notification_recipients"("in_app_notification_id");
CREATE INDEX "coordinator_evaluator_notification_recipients_email_provider_message_id_idx" ON "coordinator_evaluator_notification_recipients"("email_provider_message_id");

ALTER TABLE "coordinator_evaluator_notification_campaigns"
    ADD CONSTRAINT "coordinator_evaluator_notification_campaigns_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_campaigns"
    ADD CONSTRAINT "coordinator_evaluator_notification_campaigns_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_campaigns"
    ADD CONSTRAINT "coordinator_evaluator_notification_campaigns_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_recipients"
    ADD CONSTRAINT "coordinator_evaluator_notification_recipients_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "coordinator_evaluator_notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_recipients"
    ADD CONSTRAINT "coordinator_evaluator_notification_recipients_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_recipients"
    ADD CONSTRAINT "coordinator_evaluator_notification_recipients_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_recipients"
    ADD CONSTRAINT "coordinator_evaluator_notification_recipients_evaluator_user_id_fkey"
    FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coordinator_evaluator_notification_recipients"
    ADD CONSTRAINT "coordinator_evaluator_notification_recipients_in_app_notification_id_fkey"
    FOREIGN KEY ("in_app_notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;