CREATE TYPE "public"."theme_proposal_status" AS ENUM('open', 'promoted', 'dismissed');--> statement-breakpoint
CREATE TABLE "theme_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rationale" text,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"status" "theme_proposal_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "theme_proposals_name_uq" ON "theme_proposals" USING btree ("name");