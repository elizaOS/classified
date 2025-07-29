CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_name" text NOT NULL,
	"client_description" text,
	"client_type" text DEFAULT 'public' NOT NULL,
	"grant_types" json DEFAULT '["authorization_code"]'::json NOT NULL,
	"scopes" json DEFAULT '["read"]'::json NOT NULL,
	"redirect_uris" json DEFAULT '[]'::json NOT NULL,
	"allowed_origins" json DEFAULT '[]'::json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_clients_org_client_idx" ON "oauth_clients" USING btree ("organization_id");