-- Migration: Add usage_records table for tracking API usage
-- This table is already defined in schema.ts but needs to be created in the database

-- Create the usage_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS "usage_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "api_key_id" UUID NOT NULL REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost" DECIMAL(10, 6) NOT NULL,
  "duration" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "error_message" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "request_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "usage_records_organization_id_idx" ON "usage_records"("organization_id");
CREATE INDEX IF NOT EXISTS "usage_records_api_key_id_idx" ON "usage_records"("api_key_id");
CREATE INDEX IF NOT EXISTS "usage_records_provider_idx" ON "usage_records"("provider");
CREATE INDEX IF NOT EXISTS "usage_records_created_at_idx" ON "usage_records"("created_at");
CREATE INDEX IF NOT EXISTS "usage_records_success_idx" ON "usage_records"("success");
CREATE INDEX IF NOT EXISTS "usage_records_org_provider_date_idx" ON "usage_records"("organization_id", "provider", "created_at");

-- Add comment
COMMENT ON TABLE "usage_records" IS 'API usage tracking for billing and analytics';