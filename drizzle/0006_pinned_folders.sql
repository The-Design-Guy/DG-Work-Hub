ALTER TABLE "folder" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
-- One-time: pin the "AI TOOLS" folder to the top bar, as requested.
UPDATE "folder" SET "pinned_at" = now() WHERE lower(trim("name")) = 'ai tools' AND "deleted_at" IS NULL;
