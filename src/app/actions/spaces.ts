"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { space, folder, bookmark } = schema;
const name = z.string().trim().min(1).max(60);

async function ownedSpace(ownerId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [s] = await db.select({ id: space.id }).from(space).where(and(eq(space.id, id), eq(space.ownerId, ownerId)));
  return s ?? null;
}

const done = <T extends object>(extra?: T) => {
  revalidatePath("/", "layout");
  return { ok: true as const, ...(extra ?? ({} as T)) };
};

export async function createSpace(raw: string) {
  const user = await requireUser();
  const n = name.safeParse(raw);
  if (!n.success) return { ok: false as const, error: "Give the tab a name." };
  const [m] = await db
    .select({ m: sql<number>`coalesce(max(${space.sortOrder}), 0)` })
    .from(space)
    .where(eq(space.ownerId, user.id));
  const [row] = await db
    .insert(space)
    .values({ ownerId: user.id, name: n.data, sortOrder: Number(m?.m ?? 0) + 1 })
    .returning({ id: space.id });
  return done({ id: row.id });
}

export async function renameSpace(id: string, raw: string) {
  const user = await requireUser();
  const n = name.safeParse(raw);
  if (!n.success || !(await ownedSpace(user.id, id))) return { ok: false as const, error: "Give the tab a name." };
  await db.update(space).set({ name: n.data }).where(eq(space.id, id));
  return done();
}

export async function moveSpace(id: string, dir: -1 | 1) {
  const user = await requireUser();
  const all = await db
    .select({ id: space.id })
    .from(space)
    .where(eq(space.ownerId, user.id))
    .orderBy(asc(space.sortOrder), asc(space.createdAt));
  const i = all.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return { ok: false as const };
  [all[i], all[j]] = [all[j], all[i]];
  await atomic(all.map((s, k) => db.update(space).set({ sortOrder: k + 1 }).where(eq(space.id, s.id))));
  return done();
}

/** Deletes a tab. Its folders and links are kept and simply show under All. */
export async function deleteSpace(id: string) {
  const user = await requireUser();
  if (!(await ownedSpace(user.id, id))) return { ok: false as const };
  await atomic([
    db.update(folder).set({ spaceId: null }).where(and(eq(folder.ownerId, user.id), eq(folder.spaceId, id))),
    db.update(bookmark).set({ spaceId: null }).where(and(eq(bookmark.ownerId, user.id), eq(bookmark.spaceId, id))),
    db.delete(space).where(eq(space.id, id)),
  ]);
  return done();
}

/** Puts a top-level folder or link in a tab (null = no tab). Moves it to Home if it was nested. */
export async function setItemSpace(type: "folder" | "bookmark", id: string, spaceId: string | null) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false as const };
  if (spaceId && !(await ownedSpace(user.id, spaceId))) return { ok: false as const };
  const now = new Date();
  if (type === "folder") {
    const [f] = await db
      .select({ parentId: folder.parentId })
      .from(folder)
      .where(and(eq(folder.id, id), eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
    if (!f) return { ok: false as const };
    const toRoot = f.parentId
      ? {
          parentId: null,
          sortOrder:
            Number(
              (
                await db
                  .select({ m: sql<number>`coalesce(max(${folder.sortOrder}), 0)` })
                  .from(folder)
                  .where(and(eq(folder.ownerId, user.id), isNull(folder.parentId)))
              )[0]?.m ?? 0,
            ) + 1,
        }
      : {};
    await db.update(folder).set({ spaceId, updatedAt: now, ...toRoot }).where(eq(folder.id, id));
    return done({ moved: !!f.parentId });
  }
  const [b] = await db
    .select({ folderId: bookmark.folderId })
    .from(bookmark)
    .where(and(eq(bookmark.id, id), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)));
  if (!b) return { ok: false as const };
  const toRoot = b.folderId
    ? {
        folderId: null,
        sortOrder:
          Number(
            (
              await db
                .select({ m: sql<number>`coalesce(max(${bookmark.sortOrder}), 0)` })
                .from(bookmark)
                .where(and(eq(bookmark.ownerId, user.id), isNull(bookmark.folderId)))
            )[0]?.m ?? 0,
          ) + 1,
      }
    : {};
  await db.update(bookmark).set({ spaceId, updatedAt: now, ...toRoot }).where(eq(bookmark.id, id));
  return done({ moved: !!b.folderId });
}
