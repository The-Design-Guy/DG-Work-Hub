"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { folder, bookmark } = schema;

const input = z.object({
  folders: z.array(z.object({ id: z.uuid(), parentId: z.uuid().nullable(), sortOrder: z.number().int().min(0) })).max(5000),
  bookmarks: z.array(z.object({ id: z.uuid(), folderId: z.uuid().nullable(), sortOrder: z.number().int().min(0) })).max(20000),
});

export type OrganizeInput = z.infer<typeof input>;

/** Applies a whole Organize session at once: new parents and new order. */
export async function applyOrganize(raw: unknown) {
  const user = await requireUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Invalid changes." };
  const { folders: fChanges, bookmarks: bChanges } = parsed.data;
  if (!fChanges.length && !bChanges.length) return { ok: true as const };

  // Everything referenced must belong to this user and not be in Trash.
  const all = await db
    .select({ id: folder.id, parentId: folder.parentId })
    .from(folder)
    .where(and(eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
  const parent = new Map(all.map((f) => [f.id, f.parentId]));
  for (const c of fChanges) {
    if (!parent.has(c.id)) return { ok: false as const, error: "A folder was not found. Reload and try again." };
    if (c.parentId && !parent.has(c.parentId)) return { ok: false as const, error: "A destination folder was not found." };
  }
  for (const c of bChanges) {
    if (c.folderId && !parent.has(c.folderId)) return { ok: false as const, error: "A destination folder was not found." };
  }
  if (bChanges.length) {
    const ids = bChanges.map((c) => c.id);
    const owned = await db
      .select({ id: bookmark.id })
      .from(bookmark)
      .where(and(eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt), inArray(bookmark.id, ids)));
    if (owned.length !== new Set(ids).size) return { ok: false as const, error: "A link was not found. Reload and try again." };
  }

  // No folder may end up inside itself.
  for (const c of fChanges) parent.set(c.id, c.parentId);
  for (const id of parent.keys()) {
    const seen = new Set<string>();
    let cur: string | null | undefined = id;
    while (cur) {
      if (seen.has(cur)) return { ok: false as const, error: "A folder can't be placed inside itself." };
      seen.add(cur);
      cur = parent.get(cur);
    }
  }

  const now = new Date();
  await atomic([
    ...fChanges.map((c) =>
      db
        .update(folder)
        .set({ parentId: c.parentId, sortOrder: c.sortOrder, updatedAt: now })
        .where(and(eq(folder.id, c.id), eq(folder.ownerId, user.id))),
    ),
    ...bChanges.map((c) =>
      db
        .update(bookmark)
        .set({ folderId: c.folderId, sortOrder: c.sortOrder, updatedAt: now })
        .where(and(eq(bookmark.id, c.id), eq(bookmark.ownerId, user.id))),
    ),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
