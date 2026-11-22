"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { folder, bookmark } = schema;
const CHUNK = 1000;

function rowsOf<T>(res: unknown): T[] {
  return (res && typeof res === "object" && "rows" in res ? (res as { rows: T[] }).rows : (res as T[])) ?? [];
}

function chunks<T>(list: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

const parentFolder = alias(folder, "p");
const trashedFolders = (ownerId: string) =>
  db
    .select({ id: parentFolder.id })
    .from(parentFolder)
    .where(and(eq(parentFolder.ownerId, ownerId), isNotNull(parentFolder.deletedAt)));

/** Moves a link to Trash. */
export async function trashBookmark(id: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false as const };
  const batch = randomUUID();
  const rows = await db
    .update(bookmark)
    .set({ deletedAt: new Date(), deleteBatchId: batch })
    .where(and(eq(bookmark.id, id), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)))
    .returning({ id: bookmark.id });
  revalidatePath("/", "layout");
  return rows.length ? { ok: true as const, batch } : { ok: false as const };
}

/** Moves a folder, all its subfolders and every link inside them to Trash, as one restorable batch. */
export async function trashFolder(id: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false as const };
  const res = await db.execute(sql`
    with recursive tree as (
      select id from ${folder} where id = ${id} and owner_id = ${user.id} and deleted_at is null
      union all
      select f.id from ${folder} f join tree t on f.parent_id = t.id
      where f.owner_id = ${user.id} and f.deleted_at is null
    )
    select id from tree`);
  const ids = rowsOf<{ id: string }>(res).map((r) => r.id);
  if (!ids.length) return { ok: false as const };

  const batch = randomUUID();
  const now = new Date();
  await atomic(
    chunks(ids).flatMap((part) => [
      db
        .update(bookmark)
        .set({ deletedAt: now, deleteBatchId: batch })
        .where(and(eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt), inArray(bookmark.folderId, part))),
      db
        .update(folder)
        .set({ deletedAt: now, deleteBatchId: batch })
        .where(and(eq(folder.ownerId, user.id), isNull(folder.deletedAt), inArray(folder.id, part))),
    ]),
  );
  revalidatePath("/", "layout");
  return { ok: true as const, batch };
}

/**
 * Restores everything deleted together. Items whose parent folder is still in
 * Trash come back at the top level instead, so nothing ends up hidden.
 */
export async function restoreBatch(batch: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(batch).success) return { ok: false as const };
  const now = new Date();
  await atomic([
    db
      .update(folder)
      .set({ deletedAt: null, deleteBatchId: null, updatedAt: now })
      .where(and(eq(folder.ownerId, user.id), eq(folder.deleteBatchId, batch))),
    db
      .update(bookmark)
      .set({ deletedAt: null, deleteBatchId: null, updatedAt: now })
      .where(and(eq(bookmark.ownerId, user.id), eq(bookmark.deleteBatchId, batch))),
    // Re-home anything whose parent is still trashed.
    db
      .update(folder)
      .set({ parentId: null, isProject: false })
      .where(and(eq(folder.ownerId, user.id), isNull(folder.deletedAt), inArray(folder.parentId, trashedFolders(user.id)))),
    db
      .update(bookmark)
      .set({ folderId: null })
      .where(and(eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt), inArray(bookmark.folderId, trashedFolders(user.id)))),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
