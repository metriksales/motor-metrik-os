CREATE TABLE "runtime_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid,
	"motor" text,
	"ok" boolean NOT NULL,
	"resumo" text NOT NULL,
	"did" jsonb,
	"erro" text,
	"valor_centavos" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE INDEX "runtime_logs_org_at" ON "runtime_logs" USING btree ("org_id","at");