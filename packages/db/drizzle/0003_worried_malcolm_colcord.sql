CREATE TABLE "contact_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"contato" text NOT NULL,
	"estado" text DEFAULT 'humano' NOT NULL,
	"assumido_por" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_states" ADD CONSTRAINT "contact_states_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_states_agent_contato" ON "contact_states" USING btree ("agent_id","contato");--> statement-breakpoint
CREATE INDEX "contact_states_org" ON "contact_states" USING btree ("org_id");