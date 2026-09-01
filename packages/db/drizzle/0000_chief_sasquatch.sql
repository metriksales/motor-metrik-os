CREATE TYPE "public"."agent_state" AS ENUM('ativo', 'idle', 'pausado');--> statement-breakpoint
CREATE TYPE "public"."agent_tipo" AS ENUM('resposta', 'acao');--> statement-breakpoint
CREATE TYPE "public"."change_origin" AS ENUM('hub_chat', 'hub_visual', 'claude_code', 'codex', 'api', 'metrik');--> statement-breakpoint
CREATE TYPE "public"."change_status" AS ENUM('draft', 'evaluated', 'approved', 'published', 'ignored', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."conn_kind" AS ENUM('ghl', 'kommo', 'whatsapp', 'advbox', 'zapsign', 'gcal');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'operator', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."spec_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "agent_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"spec" jsonb NOT NULL,
	"status" "spec_status" DEFAULT 'draft' NOT NULL,
	"origin" "change_origin" DEFAULT 'metrik' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tipo" "agent_tipo" NOT NULL,
	"state" "agent_state" DEFAULT 'idle' NOT NULL,
	"current_spec_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"actor" text,
	"action" text NOT NULL,
	"target" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"origin" "change_origin" NOT NULL,
	"actor" text NOT NULL,
	"intent" text,
	"patch" jsonb,
	"before" jsonb,
	"after" jsonb,
	"impact" jsonb,
	"status" "change_status" DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "conn_kind" NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"vault_ref" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" DEFAULT 'operator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'autonomo' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"spec_version" integer NOT NULL,
	"runtime_version" text NOT NULL,
	"eval_run" text,
	"git_sha" text,
	"promoted_by" text,
	"promoted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_specs" ADD CONSTRAINT "agent_specs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_specs_agent_version" ON "agent_specs" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "agents_org" ON "agents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "change_sets_org_agent" ON "change_sets" USING btree ("org_id","agent_id");--> statement-breakpoint
CREATE INDEX "connections_org" ON "connections" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user" ON "memberships" USING btree ("org_id","user_id");