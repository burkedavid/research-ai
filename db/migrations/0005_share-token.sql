ALTER TABLE "saved_outputs" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "saved_outputs" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_outputs" ADD CONSTRAINT "saved_outputs_share_token_unique" UNIQUE("share_token");