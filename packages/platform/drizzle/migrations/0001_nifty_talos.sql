CREATE TABLE IF NOT EXISTS "anonymous_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"chat_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"workflow_progress" jsonb DEFAULT '{"currentStep":"discovery","workflowType":null,"requirements":{},"generatedAssets":[],"customizations":[]}'::jsonb NOT NULL,
	"user_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp DEFAULT now() + interval '7 days' NOT NULL,
	"migrated_to_user_id" uuid,
	"migrated_at" timestamp,
	CONSTRAINT "anonymous_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"total_generations" integer NOT NULL,
	"completed_generations" integer DEFAULT 0 NOT NULL,
	"failed_generations" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"estimated_completion_at" timestamp,
	"batch_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crypto_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"token_address" text NOT NULL,
	"token_symbol" text NOT NULL,
	"amount_crypto" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"amount_credits" integer NOT NULL,
	"chain_id" integer NOT NULL,
	"transaction_hash" text,
	"block_number" integer,
	"block_confirmations" integer DEFAULT 0,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"wallet_type" text,
	"slippage_tolerance" numeric(3, 1),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"queue_name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"worker_id" text,
	"claimed_at" timestamp,
	"last_error" text,
	"last_attempt_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"prompt" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"outputs" jsonb DEFAULT '[]'::jsonb,
	"estimated_cost" numeric(10, 6),
	"actual_cost" numeric(10, 6),
	"credits_used" integer,
	"processing_time" integer,
	"queue_time" integer,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"idempotency_key" text NOT NULL,
	"callback_url" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"hour" integer,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"successful_requests" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"cancelled_requests" integer DEFAULT 0 NOT NULL,
	"average_processing_time" integer DEFAULT 0,
	"p95_processing_time" integer DEFAULT 0,
	"average_queue_time" integer DEFAULT 0,
	"total_cost" numeric(10, 6) DEFAULT '0',
	"average_cost" numeric(10, 6) DEFAULT '0',
	"quality_score" numeric(3, 2) DEFAULT '0',
	"user_satisfaction_score" numeric(3, 2) DEFAULT '0',
	"error_types" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_type" text NOT NULL,
	"signature_message" text NOT NULL,
	"signature" text NOT NULL,
	"nonce" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anonymous_sessions" ADD CONSTRAINT "anonymous_sessions_migrated_to_user_id_users_id_fk" FOREIGN KEY ("migrated_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batch_generations" ADD CONSTRAINT "batch_generations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batch_generations" ADD CONSTRAINT "batch_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_queue" ADD CONSTRAINT "generation_queue_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generations" ADD CONSTRAINT "generations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_connections" ADD CONSTRAINT "wallet_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_connections" ADD CONSTRAINT "wallet_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anonymous_sessions_session_id_idx" ON "anonymous_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anonymous_sessions_expires_at_idx" ON "anonymous_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anonymous_sessions_last_activity_idx" ON "anonymous_sessions" USING btree ("last_activity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_generations_organization_id_idx" ON "batch_generations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_generations_user_id_idx" ON "batch_generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_generations_status_idx" ON "batch_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batch_generations_created_at_idx" ON "batch_generations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_organization_id_idx" ON "crypto_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_user_id_idx" ON "crypto_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_wallet_address_idx" ON "crypto_payments" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_status_idx" ON "crypto_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_transaction_hash_idx" ON "crypto_payments" USING btree ("transaction_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_chain_id_idx" ON "crypto_payments" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_created_at_idx" ON "crypto_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crypto_payments_expires_at_idx" ON "crypto_payments" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_generation_id_idx" ON "generation_queue" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_queue_name_idx" ON "generation_queue" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_status_idx" ON "generation_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_priority_idx" ON "generation_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_scheduled_for_idx" ON "generation_queue" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_worker_id_idx" ON "generation_queue" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_queue_queue_status_priority_idx" ON "generation_queue" USING btree ("queue_name","status","priority","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_organization_id_idx" ON "generations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_user_id_idx" ON "generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_project_id_idx" ON "generations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_type_idx" ON "generations" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_provider_idx" ON "generations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_status_idx" ON "generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_idempotency_key_idx" ON "generations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_created_at_idx" ON "generations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_queued_at_idx" ON "generations" USING btree ("queued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_org_type_provider_idx" ON "generations" USING btree ("organization_id","type","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_status_queued_idx" ON "generations" USING btree ("status","queued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_metrics_provider_idx" ON "provider_metrics" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_metrics_type_idx" ON "provider_metrics" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_metrics_date_idx" ON "provider_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_metrics_hour_idx" ON "provider_metrics" USING btree ("hour");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_metrics_provider_date_hour_unique" ON "provider_metrics" USING btree ("provider","type","date","hour");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_metrics_provider_date_unique" ON "provider_metrics" USING btree ("provider","type","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_connections_user_id_idx" ON "wallet_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_connections_organization_id_idx" ON "wallet_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_connections_wallet_address_idx" ON "wallet_connections" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_connections_chain_id_idx" ON "wallet_connections" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_connections_is_active_idx" ON "wallet_connections" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_connections_user_wallet_unique" ON "wallet_connections" USING btree ("user_id","wallet_address","chain_id");