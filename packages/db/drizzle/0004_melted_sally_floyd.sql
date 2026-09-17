CREATE TABLE "group_reader_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"group_jid" text NOT NULL,
	"group_name" text,
	"sender_hash" text,
	"sender_last4" text,
	"sender_name" text,
	"message_type" text DEFAULT 'unknown' NOT NULL,
	"message_text" text NOT NULL,
	"from_me" boolean DEFAULT false NOT NULL,
	"sent_by_api" boolean DEFAULT false NOT NULL,
	"event_name" text DEFAULT 'messages' NOT NULL,
	"source" text DEFAULT 'uazapi' NOT NULL,
	"status" text DEFAULT 'captured' NOT NULL,
	"occurred_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "group_reader_events_group_message_unique" ON "group_reader_events" USING btree ("group_jid","message_id");--> statement-breakpoint
CREATE INDEX "group_reader_events_received_at_idx" ON "group_reader_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "group_reader_events_group_received_idx" ON "group_reader_events" USING btree ("group_jid","received_at");