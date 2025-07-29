CREATE TABLE IF NOT EXISTS "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"room_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_for" timestamp,
	"recurring_interval" integer,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_executed_at" timestamp,
	"next_execution_at" timestamp,
	"completed_at" timestamp,
	"result" jsonb,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"avatar_url" text,
	"character" jsonb NOT NULL,
	"plugins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runtime_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deployment_status" text DEFAULT 'draft' NOT NULL,
	"deployment_url" text,
	"deployment_error" text,
	"last_deployed_at" timestamp,
	"runtime_agent_id" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"total_cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_limit" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"participant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"amount" numeric(10, 6) NOT NULL,
	"description" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"crypto_transaction_hash" text,
	"payment_method" text,
	"agent_id" uuid,
	"usage_record_id" text,
	"balance_after" numeric(10, 6) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"client_id" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"interval" integer DEFAULT 5 NOT NULL,
	"is_authorized" boolean DEFAULT false NOT NULL,
	"authorized_at" timestamp,
	"authorized_by_user_id" uuid,
	"access_token" text,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_codes_device_code_unique" UNIQUE("device_code"),
	CONSTRAINT "device_codes_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"type" text DEFAULT 'person' NOT NULL,
	"components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"relationship_summary" text,
	"last_interaction_at" timestamp,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inference_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid,
	"user_id" uuid,
	"api_key_id" uuid,
	"request_id" text NOT NULL,
	"session_id" text,
	"conversation_id_ref" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"endpoint" text NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_payload" jsonb,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"base_cost" numeric(10, 6) NOT NULL,
	"markup_percentage" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"markup_amount" numeric(10, 6) DEFAULT '0' NOT NULL,
	"total_cost" numeric(10, 6) NOT NULL,
	"latency" integer NOT NULL,
	"time_to_first_token" integer,
	"processing_time" integer,
	"queue_time" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"error_code" text,
	"error_message" text,
	"http_status_code" integer,
	"ip_address" text,
	"user_agent" text,
	"referer" text,
	"origin" text,
	"content_type" text,
	"language" text,
	"content_length" integer,
	"response_length" integer,
	"feature" text,
	"workflow_step" text,
	"retry_attempt" integer DEFAULT 0 NOT NULL,
	"retention_policy" text DEFAULT 'standard' NOT NULL,
	"is_personal_data" boolean DEFAULT false NOT NULL,
	"data_classification" text DEFAULT 'public' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inference_logs_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"content" jsonb NOT NULL,
	"embedding" text,
	"similarity" numeric(5, 4),
	"type" text DEFAULT 'conversation' NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"is_unique" boolean DEFAULT false NOT NULL,
	"room_id" text,
	"world_id" text,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid,
	"content" jsonb NOT NULL,
	"role" text NOT NULL,
	"parent_message_id" uuid,
	"embedding" text,
	"token_count" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"processing_time" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_name" text NOT NULL,
	"client_description" text,
	"client_type" text DEFAULT 'public' NOT NULL,
	"grant_types" jsonb DEFAULT '["authorization_code","device_code"]'::jsonb NOT NULL,
	"scopes" jsonb DEFAULT '["read","write"]'::jsonb NOT NULL,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logo_url" text,
	"homepage_url" text,
	"terms_url" text,
	"privacy_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"access_token_ttl" integer DEFAULT 3600 NOT NULL,
	"refresh_token_ttl" integer DEFAULT 86400 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"installed_by_user_id" uuid,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"logo_url" text,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"subscription_status" text DEFAULT 'active' NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_agents" integer DEFAULT 3 NOT NULL,
	"max_api_requests" integer DEFAULT 10000 NOT NULL,
	"max_tokens_per_request" integer DEFAULT 4096 NOT NULL,
	"max_storage_gb" integer DEFAULT 1 NOT NULL,
	"workos_organization_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"billing_email" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"credit_balance" numeric(10, 6) DEFAULT '0' NOT NULL,
	"credit_threshold" numeric(10, 6) DEFAULT '10' NOT NULL,
	"auto_top_up_enabled" boolean DEFAULT false NOT NULL,
	"auto_top_up_amount" numeric(10, 6) DEFAULT '50' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_workos_organization_id_unique" UNIQUE("workos_organization_id"),
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "organizations_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"config_key" text NOT NULL,
	"config_value" text,
	"config_type" text DEFAULT 'string' NOT NULL,
	"numeric_value" numeric(10, 6),
	"boolean_value" boolean,
	"json_value" jsonb,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"is_editable" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"version" text NOT NULL,
	"author" text,
	"repository_url" text,
	"documentation_url" text,
	"npm_package" text,
	"package_version" text,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"security_review_status" text DEFAULT 'pending' NOT NULL,
	"security_review_notes" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plugins_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"limit_key" text NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"window_end" timestamp NOT NULL,
	"max_requests" integer NOT NULL,
	"window_duration" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limits_limit_key_unique" UNIQUE("limit_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_provider" text DEFAULT 'r2' NOT NULL,
	"storage_path" text NOT NULL,
	"storage_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 6) NOT NULL,
	"duration" integer NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "user_sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workos_user_id" text,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"profile_picture_url" text,
	"role" text DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_delivery_at" timestamp,
	"last_delivery_status" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_codes" ADD CONSTRAINT "device_codes_authorized_by_user_id_users_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_conversation_id_ref_conversations_id_fk" FOREIGN KEY ("conversation_id_ref") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memories" ADD CONSTRAINT "memories_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_plugins" ADD CONSTRAINT "organization_plugins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_plugins" ADD CONSTRAINT "organization_plugins_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_plugins" ADD CONSTRAINT "organization_plugins_installed_by_user_id_users_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploads" ADD CONSTRAINT "uploads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_organization_id_idx" ON "agent_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_agent_id_idx" ON "agent_tasks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_status_idx" ON "agent_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_scheduled_for_idx" ON "agent_tasks" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_next_execution_at_idx" ON "agent_tasks" USING btree ("next_execution_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_room_id_idx" ON "agent_tasks" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_organization_id_idx" ON "agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_created_by_user_idx" ON "agents" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_org_slug_unique" ON "agents" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_deployment_status_idx" ON "agents" USING btree ("deployment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_visibility_idx" ON "agents" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_organization_id_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_organization_id_idx" ON "conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_agent_id_idx" ON "conversations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_is_active_idx" ON "conversations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_organization_id_idx" ON "credit_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_type_idx" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_created_at_idx" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_stripe_payment_intent_idx" ON "credit_transactions" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_agent_id_idx" ON "credit_transactions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_codes_device_code_idx" ON "device_codes" USING btree ("device_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_codes_user_code_idx" ON "device_codes" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_codes_client_id_idx" ON "device_codes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_codes_expires_at_idx" ON "device_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_codes_is_authorized_idx" ON "device_codes" USING btree ("is_authorized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_organization_id_idx" ON "entities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_agent_id_idx" ON "entities" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_user_id_idx" ON "entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_type_idx" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_last_interaction_at_idx" ON "entities" USING btree ("last_interaction_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entities_agent_name_unique" ON "entities" USING btree ("agent_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_organization_id_idx" ON "inference_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_agent_id_idx" ON "inference_logs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_user_id_idx" ON "inference_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_provider_idx" ON "inference_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_model_idx" ON "inference_logs" USING btree ("model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_status_idx" ON "inference_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_created_at_idx" ON "inference_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_request_id_idx" ON "inference_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_org_provider_model_date_idx" ON "inference_logs" USING btree ("organization_id","provider","model","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_org_date_status_idx" ON "inference_logs" USING btree ("organization_id","created_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_provider_model_idx" ON "inference_logs" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_organization_id_idx" ON "memories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_agent_id_idx" ON "memories" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_user_id_idx" ON "memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_conversation_id_idx" ON "memories" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_type_idx" ON "memories" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_importance_idx" ON "memories" USING btree ("importance");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_room_id_idx" ON "memories" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_entity_id_idx" ON "memories" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_created_at_idx" ON "memories" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_organization_id_idx" ON "messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_agent_id_idx" ON "messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_user_id_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_role_idx" ON "messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_parent_message_id_idx" ON "messages" USING btree ("parent_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_organization_id_idx" ON "oauth_clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_is_active_idx" ON "oauth_clients" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_client_type_idx" ON "oauth_clients" USING btree ("client_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_plugins_organization_id_idx" ON "organization_plugins" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_plugins_plugin_id_idx" ON "organization_plugins" USING btree ("plugin_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_plugins_org_plugin_unique" ON "organization_plugins" USING btree ("organization_id","plugin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_workos_org_idx" ON "organizations" USING btree ("workos_organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_stripe_customer_idx" ON "organizations" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_config_config_key_idx" ON "platform_config" USING btree ("config_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_config_organization_id_idx" ON "platform_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_config_category_idx" ON "platform_config" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_config_org_key_unique" ON "platform_config" USING btree ("organization_id","config_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugins_name_idx" ON "plugins" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugins_is_approved_idx" ON "plugins" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugins_is_public_idx" ON "plugins" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limits_limit_key_idx" ON "rate_limits" USING btree ("limit_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limits_window_end_idx" ON "rate_limits" USING btree ("window_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_organization_id_idx" ON "uploads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_uploaded_by_user_idx" ON "uploads" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_storage_path_idx" ON "uploads" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_mime_type_idx" ON "uploads" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_organization_id_idx" ON "usage_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_api_key_id_idx" ON "usage_records" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_provider_idx" ON "usage_records" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_created_at_idx" ON "usage_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_success_idx" ON "usage_records" USING btree ("success");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_org_provider_date_idx" ON "usage_records" USING btree ("organization_id","provider","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_session_token_idx" ON "user_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_refresh_token_idx" ON "user_sessions" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_workos_user_idx" ON "users" USING btree ("workos_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_org_email_unique" ON "users" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_organization_id_idx" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_created_by_user_idx" ON "webhooks" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhooks_is_active_idx" ON "webhooks" USING btree ("is_active");