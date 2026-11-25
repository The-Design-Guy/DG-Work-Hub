CREATE TABLE "space" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmark" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_owner_idx" ON "space" USING btree ("owner_id","sort_order");--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The four starting tabs for every user.
INSERT INTO "space" ("owner_id", "name", "sort_order")
SELECT u."id", v.name, v.ord FROM "user" u CROSS JOIN (VALUES
  ('Personal projects', 1), ('Reference & agents', 2), ('Clients', 3), ('WEB3D', 4)
) AS v(name, ord);--> statement-breakpoint
-- Today's Projects go to "Personal projects"; Library folders and loose Home links to "Reference & agents".
UPDATE "folder" f SET "space_id" = s."id" FROM "space" s
WHERE s."owner_id" = f."owner_id" AND s."sort_order" = 1 AND f."parent_id" IS NULL AND f."is_project";--> statement-breakpoint
UPDATE "folder" f SET "space_id" = s."id" FROM "space" s
WHERE s."owner_id" = f."owner_id" AND s."sort_order" = 2 AND f."parent_id" IS NULL AND NOT f."is_project";--> statement-breakpoint
UPDATE "bookmark" b SET "space_id" = s."id" FROM "space" s
WHERE s."owner_id" = b."owner_id" AND s."sort_order" = 2 AND b."folder_id" IS NULL;
