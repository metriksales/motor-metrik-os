ALTER TABLE "connections" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "inbound_secret_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "connections_inbound_secret_unique" ON "connections" USING btree ("inbound_secret_hash");