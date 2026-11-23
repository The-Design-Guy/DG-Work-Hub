"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { normalizeUrl } from "@/lib/url";
import { pageMeta, sniffImage } from "@/lib/page-meta";

const { topItem, folder, image } = schema;

async function nextOrder(ownerId: string) {
  const [m] = await db
    .select({ m: sql<number>`coalesce(max(${topItem.sortOrder}), 0)` })
    .from(topItem)
    .where(eq(topItem.ownerId, ownerId));
  return Number(m?.m ?? 0) + 1;
}

async function owned(ownerId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(topItem).where(and(eq(topItem.id, id), eq(topItem.ownerId, ownerId)));
  return row ?? null;
}

const done = () => {
  revalidatePath("/", "layout");
  return { ok: true as const };
};

export async function addTopLink(rawUrl: string, rawTitle: string) {
  const user = await requireUser();
  const norm = normalizeUrl(rawUrl);
  if (!norm) return { ok: false as const, error: "Enter a valid web address." };
  const meta = await pageMeta(norm.url).catch(() => null);
  const title = rawTitle.trim().slice(0, 80) || meta?.title?.slice(0, 80) || norm.domain;
  await db.insert(topItem).values({
    ownerId: user.id,
    kind: "link",
    title,
    url: norm.url,
    favicon: meta?.favicon ?? null,
    sortOrder: await nextOrder(user.id),
  });
  return done();
}

/** A dropdown: an existing folder, or a new folder created for it (in Library). */
export async function addTopFolder(input: { folderId?: string; newName?: string }) {
  const user = await requireUser();
  let folderId = input.folderId ?? null;
  if (!folderId) {
    const name = (input.newName ?? "").trim().slice(0, 200);
    if (!name) return { ok: false as const, error: "Give the dropdown a name." };
    const [m] = await db
      .select({ m: sql<number>`coalesce(max(${folder.sortOrder}), 0)` })
      .from(folder)
      .where(and(eq(folder.ownerId, user.id), isNull(folder.parentId)));
    const [f] = await db
      .insert(folder)
      .values({ ownerId: user.id, name, sortOrder: Number(m?.m ?? 0) + 1 })
      .returning({ id: folder.id });
    folderId = f.id;
  } else {
    if (!z.uuid().safeParse(folderId).success) return { ok: false as const, error: "Folder not found." };
    const [f] = await db
      .select({ id: folder.id })
      .from(folder)
      .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
    if (!f) return { ok: false as const, error: "Folder not found." };
    const [exists] = await db
      .select({ id: topItem.id })
      .from(topItem)
      .where(and(eq(topItem.ownerId, user.id), eq(topItem.folderId, folderId)));
    if (exists) return { ok: false as const, error: "That folder is already in the top bar." };
  }
  await db.insert(topItem).values({ ownerId: user.id, kind: "folder", folderId, sortOrder: await nextOrder(user.id) });
  return { ...done(), folderId };
}

export async function updateTopItem(id: string, patch: { title?: string; url?: string }) {
  const user = await requireUser();
  const item = await owned(user.id, id);
  if (!item) return { ok: false as const, error: "Not found." };
  const set: Partial<typeof topItem.$inferInsert> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 80);
    if (item.kind === "link" && !t) return { ok: false as const, error: "A link needs a name." };
    set.title = t || null; // empty = use the folder's own name
  }
  if (patch.url !== undefined && item.kind === "link") {
    const norm = normalizeUrl(patch.url);
    if (!norm) return { ok: false as const, error: "Enter a valid web address." };
    if (norm.url !== item.url) {
      set.url = norm.url;
      const meta = await pageMeta(norm.url).catch(() => null);
      set.favicon = meta?.favicon ?? null;
    }
  }
  if (Object.keys(set).length) await db.update(topItem).set(set).where(eq(topItem.id, id));
  return done();
}

export async function moveTopItem(id: string, dir: -1 | 1) {
  const user = await requireUser();
  const all = await db
    .select({ id: topItem.id })
    .from(topItem)
    .where(eq(topItem.ownerId, user.id))
    .orderBy(asc(topItem.sortOrder), asc(topItem.createdAt));
  const i = all.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return { ok: false as const };
  [all[i], all[j]] = [all[j], all[i]];
  await atomic(all.map((x, k) => db.update(topItem).set({ sortOrder: k + 1 }).where(eq(topItem.id, x.id))));
  return done();
}

export async function removeTopItem(id: string) {
  const user = await requireUser();
  const item = await owned(user.id, id);
  if (!item) return { ok: false as const };
  await atomic([
    db.delete(topItem).where(eq(topItem.id, id)),
    ...(item.iconImageId ? [db.delete(image).where(and(eq(image.id, item.iconImageId), eq(image.ownerId, user.id)))] : []),
  ]);
  return done();
}

export async function setTopItemIcon(id: string, form: FormData) {
  const user = await requireUser();
  const item = await owned(user.id, id);
  if (!item) return { ok: false as const, error: "Not found." };
  const file = form.get("file");
  const size = Number(form.get("size"));
  if (!(file instanceof File) || file.size === 0 || file.size > 400_000) return { ok: false as const, error: "Invalid image." };
  if (!Number.isInteger(size) || size < 16 || size > 1024) return { ok: false as const, error: "Invalid image size." };
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (mime !== "image/png" && mime !== "image/webp" && mime !== "image/jpeg") return { ok: false as const, error: "Invalid image." };
  const [img] = await db.insert(image).values({ ownerId: user.id, mime, data: buf, width: size, height: size }).returning({ id: image.id });
  await atomic([
    db.update(topItem).set({ iconImageId: img.id }).where(eq(topItem.id, id)),
    ...(item.iconImageId ? [db.delete(image).where(and(eq(image.id, item.iconImageId), eq(image.ownerId, user.id)))] : []),
  ]);
  return done();
}

export async function removeTopItemIcon(id: string) {
  const user = await requireUser();
  const item = await owned(user.id, id);
  if (!item?.iconImageId) return done();
  await atomic([
    db.update(topItem).set({ iconImageId: null }).where(eq(topItem.id, id)),
    db.delete(image).where(and(eq(image.id, item.iconImageId), eq(image.ownerId, user.id))),
  ]);
  return done();
}
