import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  uuid,
  index,
  integer,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/** bytea that works with both the Neon HTTP driver (hex text) and node-postgres (Buffer). */
const bytea = customType<{ data: Buffer; driverData: string | Buffer }>({
  dataType: () => "bytea",
  toDriver: (v) => `\\x${v.toString("hex")}`,
  fromDriver: (v) =>
    Buffer.isBuffer(v) ? v : Buffer.from(String(v).replace(/^\\x/, ""), "hex"),
});

/* ------------------------------------------------------------------ */
/* Auth tables (Better Auth)                                           */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* App tables                                                          */
/* ------------------------------------------------------------------ */
/*
 * Ordering: `sortOrder` is a double. New items go to max+1; moving an item
 * between two neighbours takes the midpoint. A periodic renumber keeps gaps
 * healthy. Order is stable and shared across devices because it lives here.
 *
 * Trash: deleting a folder stamps `deletedAt` and one shared `deleteBatchId`
 * on the folder, every descendant folder and every bookmark inside them.
 * Restoring the batch brings the whole tree back exactly as it was, without
 * touching items that were trashed separately before.
 */

/** Small uploaded images (folder covers), resized in the browser before upload. */
export const image = pgTable(
  "image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mime: text("mime").notNull(),
    data: bytea("data").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("image_owner_idx").on(t.ownerId)],
);

export const folder = pgTable(
  "folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folder.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    icon: text("icon"),
    /** Top-level folders flagged as projects show in Home's "Projects" section. */
    isProject: boolean("is_project").notNull().default(false),
    coverImageId: uuid("cover_image_id").references(() => image.id, { onDelete: "set null" }),
    /** Square icon (a site's favicon or an uploaded image, cropped 1:1). */
    iconImageId: uuid("icon_image_id").references(() => image.id, { onDelete: "set null" }),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deleteBatchId: uuid("delete_batch_id"),
    importId: uuid("import_id"),
  },
  (t) => [
    index("folder_import_idx").on(t.importId),
    index("folder_owner_parent_idx").on(t.ownerId, t.parentId, t.sortOrder),
    index("folder_owner_deleted_idx").on(t.ownerId, t.deletedAt),
    index("folder_batch_idx").on(t.deleteBatchId),
  ],
);

export const bookmark = pgTable(
  "bookmark",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folder.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    faviconUrl: text("favicon_url"),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    launchOnStart: boolean("launch_on_start").notNull().default(false),
    launchOrder: doublePrecision("launch_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deleteBatchId: uuid("delete_batch_id"),
    importId: uuid("import_id"),
  },
  (t) => [
    index("bookmark_import_idx").on(t.importId),
    index("bookmark_owner_folder_idx").on(t.ownerId, t.folderId, t.sortOrder),
    index("bookmark_owner_deleted_idx").on(t.ownerId, t.deletedAt),
    index("bookmark_owner_url_idx").on(t.ownerId, t.url),
    index("bookmark_batch_idx").on(t.deleteBatchId),
  ],
);

export type Folder = typeof folder.$inferSelect;
export type Bookmark = typeof bookmark.$inferSelect;
