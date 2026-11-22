ALTER TABLE "bookmark" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "import_id" uuid;--> statement-breakpoint
CREATE INDEX "bookmark_import_idx" ON "bookmark" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "folder_import_idx" ON "folder" USING btree ("import_id");