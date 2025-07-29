-- Migration: Add inference logging and analytics tables
-- Created: 2025-01-25

-- Add detailed inference logs table for legal compliance and analytics
CREATE TABLE IF NOT EXISTS "inference_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE CASCADE,
  
  -- Request identification
  "request_id" text NOT NULL UNIQUE,
  "session_id" text,
  "conversation_id_ref" uuid REFERENCES "conversations"("id") ON DELETE CASCADE,
  
  -- Provider and model details
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "model_version" text,
  "endpoint" text NOT NULL,
  
  -- Full request/response context for legal compliance
  "request_payload" jsonb NOT NULL,
  "response_payload" jsonb,
  
  -- Token usage
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "cached_tokens" integer NOT NULL DEFAULT 0,
  
  -- Cost breakdown
  "base_cost" decimal(10,6) NOT NULL,
  "markup_percentage" decimal(5,2) NOT NULL DEFAULT 20.00,
  "markup_amount" decimal(10,6) NOT NULL DEFAULT 0,
  "total_cost" decimal(10,6) NOT NULL,
  
  -- Performance metrics
  "latency" integer NOT NULL,
  "time_to_first_token" integer,
  "processing_time" integer,
  "queue_time" integer,
  
  -- Status and errors
  "status" text NOT NULL DEFAULT 'success',
  "error_code" text,
  "error_message" text,
  "http_status_code" integer,
  
  -- Request source and context
  "ip_address" text,
  "user_agent" text,
  "referer" text,
  "origin" text,
  
  -- Content analysis
  "content_type" text,
  "language" text,
  "content_length" integer,
  "response_length" integer,
  
  -- Business context
  "feature" text,
  "workflow_step" text,
  "retry_attempt" integer NOT NULL DEFAULT 0,
  
  -- Compliance and retention
  "retention_policy" text NOT NULL DEFAULT 'standard',
  "is_personal_data" boolean NOT NULL DEFAULT false,
  "data_classification" text NOT NULL DEFAULT 'public',
  
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Add platform configuration table for markup rates and settings
CREATE TABLE IF NOT EXISTS "platform_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  
  -- Configuration key-value pairs
  "config_key" text NOT NULL,
  "config_value" text,
  "config_type" text NOT NULL DEFAULT 'string',
  
  -- Typed values for different data types
  "numeric_value" decimal(10,6),
  "boolean_value" boolean,
  "json_value" jsonb,
  
  -- Metadata
  "description" text,
  "category" text NOT NULL DEFAULT 'general',
  "is_editable" boolean NOT NULL DEFAULT true,
  "is_public" boolean NOT NULL DEFAULT false,
  
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for inference_logs
CREATE INDEX IF NOT EXISTS "inference_logs_organization_id_idx" ON "inference_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "inference_logs_agent_id_idx" ON "inference_logs" ("agent_id");
CREATE INDEX IF NOT EXISTS "inference_logs_user_id_idx" ON "inference_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "inference_logs_provider_idx" ON "inference_logs" ("provider");
CREATE INDEX IF NOT EXISTS "inference_logs_model_idx" ON "inference_logs" ("model");
CREATE INDEX IF NOT EXISTS "inference_logs_status_idx" ON "inference_logs" ("status");
CREATE INDEX IF NOT EXISTS "inference_logs_created_at_idx" ON "inference_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "inference_logs_request_id_idx" ON "inference_logs" ("request_id");

-- Composite indexes for analytics queries
CREATE INDEX IF NOT EXISTS "inference_logs_org_provider_model_date_idx" ON "inference_logs" ("organization_id", "provider", "model", "created_at");
CREATE INDEX IF NOT EXISTS "inference_logs_org_date_status_idx" ON "inference_logs" ("organization_id", "created_at", "status");
CREATE INDEX IF NOT EXISTS "inference_logs_provider_model_idx" ON "inference_logs" ("provider", "model");

-- Create indexes for platform_config
CREATE INDEX IF NOT EXISTS "platform_config_config_key_idx" ON "platform_config" ("config_key");
CREATE INDEX IF NOT EXISTS "platform_config_organization_id_idx" ON "platform_config" ("organization_id");
CREATE INDEX IF NOT EXISTS "platform_config_category_idx" ON "platform_config" ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_config_org_key_unique" ON "platform_config" ("organization_id", "config_key");

-- Insert default platform configuration
INSERT INTO "platform_config" ("config_key", "config_value", "config_type", "numeric_value", "category", "description", "is_editable") 
VALUES 
  ('markup_percentage', '20.00', 'number', 20.00, 'pricing', 'Default markup percentage applied to AI inference costs', true),
  ('enable_detailed_logging', 'true', 'boolean', null, 'compliance', 'Enable detailed inference request/response logging for legal compliance', true),
  ('log_retention_days', '90', 'number', 90, 'compliance', 'Number of days to retain detailed inference logs', true),
  ('cost_calculation_method', 'token_based', 'string', null, 'pricing', 'Method for calculating inference costs (token_based, time_based, hybrid)', true),
  ('enable_cost_alerts', 'true', 'boolean', null, 'billing', 'Enable cost threshold alerts for organizations', true)
ON CONFLICT DO NOTHING;

-- Update organizations table to include markup settings if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'markup_percentage'
  ) THEN
    ALTER TABLE "organizations" ADD COLUMN "markup_percentage" decimal(5,2) NOT NULL DEFAULT 20.00;
  END IF;
END $$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inference_logs_updated_at 
  BEFORE UPDATE ON "inference_logs" 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_config_updated_at 
  BEFORE UPDATE ON "platform_config" 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies for inference_logs
ALTER TABLE "inference_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inference logs for their organization" ON "inference_logs"
  FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "System can insert inference logs" ON "inference_logs"
  FOR INSERT
  WITH CHECK (true);

-- Create RLS policies for platform_config  
ALTER TABLE "platform_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view config for their organization" ON "platform_config"
  FOR SELECT
  USING (
    organization_id IS NULL OR 
    organization_id = current_setting('app.current_organization_id', true)::uuid
  );

CREATE POLICY "Admins can manage platform config" ON "platform_config"
  FOR ALL
  USING (
    current_setting('app.current_user_is_admin', true)::boolean = true OR
    (organization_id = current_setting('app.current_organization_id', true)::uuid)
  )
  WITH CHECK (
    current_setting('app.current_user_is_admin', true)::boolean = true OR
    (organization_id = current_setting('app.current_organization_id', true)::uuid)
  );