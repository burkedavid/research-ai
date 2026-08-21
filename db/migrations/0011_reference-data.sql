ALTER TYPE "public"."source_type" ADD VALUE 'reference_data' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "publisher" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "licence" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "source_url" text;