CREATE TYPE "public"."segment_status" AS ENUM('active', 'merged');--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN "status" "segment_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "segments" ADD COLUMN "merged_into" uuid;