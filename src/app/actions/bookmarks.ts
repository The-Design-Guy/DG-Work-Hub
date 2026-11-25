"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { normalizeUrl, safeIconDataUri, urlKey } from "@/lib/url";
import { pageMeta } from "@/lib/page-meta";

const { bookmark, folder } = schema;

async function ownsFolder(ownerId: string, id: string | null) {
  if (!id) return true;
  const [f] = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.id, id), eq(folder.ownerId, ownerId), isNull(folder.deletedAt)));
  return !!f;
}

async function validSpace(ownerId: string, id: string | null) {
  if (!id) return null;
  const [s] = await db
    .select({ id: schema.space.id })
    .from(schema.space)
    .where(and(eq(schema.space.id, id), eq(schema.space.ownerId, ownerId)));
  return s?.id ?? null;
}

export async function setLaunch(id: string, value: boolean) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false as const };
  const rows = await db
    .update(bookmark)
    .set({ launchOnStart: value, updatedAt: new Date() })
    .where(and(eq(bookmark.id, id), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)))
    .returning({ id: bookmark.id });
  revalidatePath("/", "layout");
  return { ok: rows.length === 1 };
}

/** Looks up a link before saving: title, description, icon, and whether you already have it. */
export async function previewLink(input: string) {
  const user = await requireUser();
  const norm = normalizeUrl(input);
  if (!norm) return { ok: false as const, error: "Enter a valid web address (http or https)." };

  const key = urlKey(norm.url);
  const existing = await db
    .select({ url: bookmark.url, folderName: folder.name })
    .from(bookmark)
    .leftJoin(folder, eq(folder.id, bookmark.folderId))
    .where(and(eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt), eq(bookmark.domain, norm.domain)));
  const dup = existing.find((e) => urlKey(e.url) === key);

  const meta = await pageMeta(norm.url);
  return {
    ok: true as const,
    url: norm.url,
    domain: norm.domain,
    title: meta.title,
    description: meta.description,
    favicon: meta.favicon,
    duplicateIn: dup ? (dup.folderName ?? "Home") : null,
  };
}

const bookmarkInput = z.object({
  url: z.string().max(4096),
  title: z.string().max(500),
  description: z.string().max(2000),
  folderId: z.uuid().nullable(),
  spaceId: z.uuid().nullable().optional(),
  launchOnStart: z.boolean(),
  favicon: z.string().max(16_000).nullable(),
});

export async function createBookmark(raw: unknown) {
  const user = await requireUser();
  const p = bookmarkInput.safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Invalid bookmark." };
  const norm = normalizeUrl(p.data.url);
  if (!norm) return { ok: false as const, error: "Only http and https links can be saved." };
  if (!(await ownsFolder(user.id, p.data.folderId))) return { ok: false as const, error: "Folder not found." };

  let { title, description } = p.data;
  let favicon = safeIconDataUri(p.data.favicon);
  if (!title.trim()) {
    const meta = await pageMeta(norm.url).catch(() => null);
    if (!title.trim()) title = meta?.title ?? "";
    if (!description.trim() && meta?.description) description = meta.description;
    favicon ??= meta?.favicon ?? null;
  }

  const where = p.data.folderId ? eq(bookmark.folderId, p.data.folderId) : isNull(bookmark.folderId);
  const [m] = await db
    .select({ m: sql<number>`coalesce(max(${bookmark.sortOrder}), 0)` })
    .from(bookmark)
    .where(and(eq(bookmark.ownerId, user.id), where));
  const [row] = await db
    .insert(bookmark)
    .values({
      ownerId: user.id,
      folderId: p.data.folderId,
      spaceId: p.data.folderId ? null : await validSpace(user.id, p.data.spaceId ?? null),
      title: title.trim() || norm.domain,
      url: norm.url,
      domain: norm.domain,
      description: description.trim() || null,
      faviconUrl: favicon,
      launchOnStart: p.data.launchOnStart,
      sortOrder: Number(m?.m ?? 0) + 1,
    })
    .returning({ id: bookmark.id });
  revalidatePath("/", "layout");
  return { ok: true as const, id: row.id, folderId: p.data.folderId };
}

const editInput = z.object({
  id: z.uuid(),
  url: z.string().max(4096),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(2000),
  launchOnStart: z.boolean(),
});

export async function updateBookmark(raw: unknown) {
  const user = await requireUser();
  const p = editInput.safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Check the title and link." };
  const norm = normalizeUrl(p.data.url);
  if (!norm) return { ok: false as const, error: "Only http and https links can be saved." };
  const rows = await db
    .update(bookmark)
    .set({
      title: p.data.title,
      url: norm.url,
      domain: norm.domain,
      description: p.data.description.trim() || null,
      launchOnStart: p.data.launchOnStart,
      updatedAt: new Date(),
    })
    .where(and(eq(bookmark.id, p.data.id), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)))
    .returning({ id: bookmark.id });
  revalidatePath("/", "layout");
  return rows.length ? { ok: true as const } : { ok: false as const, error: "Link not found." };
}
