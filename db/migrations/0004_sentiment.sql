CREATE TYPE "public"."sentiment" AS ENUM('positive', 'negative', 'neutral', 'mixed');--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "sentiment" "sentiment";