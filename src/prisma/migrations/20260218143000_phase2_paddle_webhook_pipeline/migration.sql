CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paddle',
    "provider_event_id" TEXT NOT NULL,
    "notification_id" TEXT,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "paddle_product_id" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "paddle_price_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_events_provider_event_id_key" ON "billing_webhook_events"("provider_event_id");
CREATE INDEX IF NOT EXISTS "billing_webhook_events_provider_event_type_idx" ON "billing_webhook_events"("provider", "event_type");
CREATE INDEX IF NOT EXISTS "billing_webhook_events_status_idx" ON "billing_webhook_events"("status");
CREATE INDEX IF NOT EXISTS "billing_webhook_events_processed_at_idx" ON "billing_webhook_events"("processed_at");

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_paddle_product_id_key" ON "subscription_plans"("paddle_product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_paddle_price_id_key" ON "subscription_plans"("paddle_price_id");
