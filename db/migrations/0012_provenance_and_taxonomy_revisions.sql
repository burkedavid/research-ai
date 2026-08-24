CREATE TYPE "public"."taxonomy_revision_kind" AS ENUM('create', 'rename', 'define', 'merge', 'promote');--> statement-breakpoint
CREATE TABLE "taxonomy_revisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "taxonomy_revision_kind" NOT NULL,
	"theme_id" uuid,
	"theme_name" text NOT NULL,
	"detail" jsonb,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunk_themes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chunk_themes" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "chunk_themes" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "definition_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "taxonomy_revisions" ADD CONSTRAINT "taxonomy_revisions_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_revisions" ADD CONSTRAINT "taxonomy_revisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: without this, every pre-existing theme and tag records the moment
-- the column was added, which would read as "the whole taxonomy was created
-- today" and mark every theme as newly added. Themes that already exist
-- predate the loaded archive; tags belong to their document's ingest time.
UPDATE "themes" SET "created_at" = COALESCE((SELECT min("created_at") FROM "documents"), "created_at");--> statement-breakpoint
UPDATE "chunk_themes" ct SET "created_at" = d."created_at"
  FROM "chunks" c JOIN "documents" d ON d."id" = c."document_id"
  WHERE c."id" = ct."chunk_id";
