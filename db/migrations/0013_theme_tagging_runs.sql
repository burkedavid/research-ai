CREATE TYPE "public"."tagging_run_status" AS ENUM('pending', 'running', 'complete', 'truncated', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "tagging_run_candidates" (
	"run_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"distance" real NOT NULL,
	"matched" boolean,
	CONSTRAINT "tagging_run_candidates_run_id_chunk_id_pk" PRIMARY KEY("run_id","chunk_id")
);
--> statement-breakpoint
CREATE TABLE "theme_tagging_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"status" "tagging_run_status" DEFAULT 'pending' NOT NULL,
	"taxonomy_version" integer DEFAULT 0 NOT NULL,
	"threshold" real NOT NULL,
	"embedding_model" text,
	"llm_model" text,
	"candidates_total" integer DEFAULT 0 NOT NULL,
	"candidates_done" integer DEFAULT 0 NOT NULL,
	"tags_added" integer DEFAULT 0 NOT NULL,
	"est_cost_gbp" numeric(12, 6),
	"error" text,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tagging_run_candidates" ADD CONSTRAINT "tagging_run_candidates_run_id_theme_tagging_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."theme_tagging_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tagging_run_candidates" ADD CONSTRAINT "tagging_run_candidates_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_tagging_runs" ADD CONSTRAINT "theme_tagging_runs_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_tagging_runs" ADD CONSTRAINT "theme_tagging_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tagging_runs_theme_idx" ON "theme_tagging_runs" USING btree ("theme_id","status");