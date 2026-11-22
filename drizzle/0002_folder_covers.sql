CREATE TABLE "image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "cover_image_id" uuid;--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_owner_idx" ON "image" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_cover_image_id_image_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."image"("id") ON DELETE set null ON UPDATE no action;