CREATE TABLE "top_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"url" text,
	"folder_id" uuid,
	"favicon" text,
	"icon_image_id" uuid,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "top_item" ADD CONSTRAINT "top_item_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_item" ADD CONSTRAINT "top_item_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_item" ADD CONSTRAINT "top_item_icon_image_id_image_id_fk" FOREIGN KEY ("icon_image_id") REFERENCES "public"."image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "top_item_owner_idx" ON "top_item" USING btree ("owner_id","sort_order");--> statement-breakpoint
-- Move the current top bar into the table: the four links, then pinned folders.
INSERT INTO "top_item" ("owner_id", "kind", "title", "url", "sort_order")
SELECT u."id", 'link', v.title, v.url, v.ord
FROM "user" u CROSS JOIN (VALUES
  ('GitHub repos', 'https://github.com/The-Design-Guy?tab=repositories', 1),
  ('Vercel projects', 'https://vercel.com/atlas-zb-project', 2),
  ('To-Do 2026', 'https://trello.com/b/qgVUTsn7/to-do-2026', 3),
  ('OpenAI Billing', 'https://platform.openai.com/settings/organization/billing/overview', 4)
) AS v(title, url, ord);--> statement-breakpoint
INSERT INTO "top_item" ("owner_id", "kind", "folder_id", "sort_order")
SELECT "owner_id", 'folder', "id", 10 + row_number() OVER (PARTITION BY "owner_id" ORDER BY "pinned_at")
FROM "folder" WHERE "pinned_at" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "folder" DROP COLUMN "pinned_at";