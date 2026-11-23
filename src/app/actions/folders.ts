"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { folder, image } = schema;
const MAX_BYTES = 1_500_000;

/** Checks the file's real bytes, not just the type it claims. */
function sniff(buf: Buffer): "image/webp" | "image/jpeg" | "image/png" | null {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

async function ownedFolder(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: folder.id, coverImageId: folder.coverImageId })
    .from(folder)
    .where(and(eq(folder.id, id), eq(folder.ownerId, ownerId), isNull(folder.deletedAt)));
  return row ?? null;
}

export async function setFolderCover(folderId: string, form: FormData) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const, error: "Folder not found." };
  const f = await ownedFolder(user.id, folderId);
  if (!f) return { ok: false as const, error: "Folder not found." };

  const file = form.get("file");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No image received." };
  if (file.size > MAX_BYTES) return { ok: false as const, error: "Image is too large." };
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4000 || height > 4000) {
    return { ok: false as const, error: "Invalid image size." };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) return { ok: false as const, error: "Use a JPG, PNG or WebP image." };

  const [img] = await db
    .insert(image)
    .values({ ownerId: user.id, mime, data: buf, width, height })
    .returning({ id: image.id });

  await atomic([
    db.update(folder).set({ coverImageId: img.id, updatedAt: new Date() }).where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
    ...(f.coverImageId ? [db.delete(image).where(and(eq(image.id, f.coverImageId), eq(image.ownerId, user.id)))] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeFolderCover(folderId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const };
  const f = await ownedFolder(user.id, folderId);
  if (!f) return { ok: false as const };
  if (f.coverImageId) {
    await atomic([
      db.update(folder).set({ coverImageId: null, updatedAt: new Date() }).where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
      db.delete(image).where(and(eq(image.id, f.coverImageId), eq(image.ownerId, user.id))),
    ]);
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * "Unpack": moves a folder's direct contents (subfolders keep their own contents)
 * up into its parent, or Home, keeping their order, then moves the now-empty
 * folder to Trash.
 */
export async function unpackFolder(folderId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const, error: "Folder not found." };
  const [f] = await db
    .select({ id: folder.id, parentId: folder.parentId })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
  if (!f) return { ok: false as const, error: "Folder not found." };

  const target = f.parentId;
  const inTarget = (col: typeof folder.parentId | typeof schema.bookmark.folderId) =>
    target ? sql`${col} = ${target}` : sql`${col} is null`;
  const { bookmark } = schema;

  const [fb] = await db
    .select({ m: sql<number>`coalesce(max(${folder.sortOrder}), 0)` })
    .from(folder)
    .where(and(eq(folder.ownerId, user.id), inTarget(folder.parentId)));
  const [bb] = await db
    .select({ m: sql<number>`coalesce(max(${bookmark.sortOrder}), 0)` })
    .from(bookmark)
    .where(and(eq(bookmark.ownerId, user.id), inTarget(bookmark.folderId)));
  const fBase = Number(fb?.m ?? 0);
  const bBase = Number(bb?.m ?? 0);
  const now = new Date();

  const kidsF = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.parentId, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)))
    .orderBy(folder.sortOrder, folder.createdAt);
  const kidsB = await db
    .select({ id: bookmark.id })
    .from(bookmark)
    .where(and(eq(bookmark.folderId, folderId), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)))
    .orderBy(bookmark.sortOrder, bookmark.createdAt);

  await atomic([
    ...kidsF.map((k, i) =>
      db
        .update(folder)
        .set({ parentId: target, sortOrder: fBase + i + 1, updatedAt: now })
        .where(and(eq(folder.id, k.id), eq(folder.ownerId, user.id))),
    ),
    ...kidsB.map((k, i) =>
      db
        .update(bookmark)
        .set({ folderId: target, sortOrder: bBase + i + 1, updatedAt: now })
        .where(and(eq(bookmark.id, k.id), eq(bookmark.ownerId, user.id))),
    ),
    db
      .update(folder)
      .set({ deletedAt: now, deleteBatchId: randomUUID(), updatedAt: now })
      .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const, target, folders: kidsF.length, bookmarks: kidsB.length };
}

async function rootMaxes(ownerId: string) {
  const { bookmark } = schema;
  const [fb] = await db
    .select({ m: sql<number>`coalesce(max(${folder.sortOrder}), 0)` })
    .from(folder)
    .where(and(eq(folder.ownerId, ownerId), isNull(folder.parentId)));
  const [bb] = await db
    .select({ m: sql<number>`coalesce(max(${bookmark.sortOrder}), 0)` })
    .from(bookmark)
    .where(and(eq(bookmark.ownerId, ownerId), isNull(bookmark.folderId)));
  return { f: Number(fb?.m ?? 0), b: Number(bb?.m ?? 0) };
}

/** Marks a folder as a project (moving it to Home if needed), or back to Library. */
export async function setProject(folderId: string, value: boolean) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const };
  const [f] = await db
    .select({ id: folder.id, parentId: folder.parentId })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
  if (!f) return { ok: false as const };
  const now = new Date();
  const move = value && f.parentId !== null ? { parentId: null, sortOrder: (await rootMaxes(user.id)).f + 1 } : {};
  await db
    .update(folder)
    .set({ isProject: value, updatedAt: now, ...move })
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true as const, moved: "parentId" in move };
}

/**
 * Every subfolder becomes a project on Home (keeping its contents), loose links
 * move to Home, and the emptied folder goes to Trash.
 */
export async function subfoldersToProjects(folderId: string) {
  const user = await requireUser();
  const { bookmark } = schema;
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const, error: "Folder not found." };
  const [f] = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
  if (!f) return { ok: false as const, error: "Folder not found." };

  const kidsF = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.parentId, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)))
    .orderBy(folder.sortOrder, folder.createdAt);
  const kidsB = await db
    .select({ id: bookmark.id })
    .from(bookmark)
    .where(and(eq(bookmark.folderId, folderId), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)))
    .orderBy(bookmark.sortOrder, bookmark.createdAt);
  if (!kidsF.length) return { ok: false as const, error: "This folder has no subfolders." };

  const base = await rootMaxes(user.id);
  const now = new Date();
  await atomic([
    ...kidsF.map((k, i) =>
      db
        .update(folder)
        .set({ parentId: null, isProject: true, sortOrder: base.f + i + 1, updatedAt: now })
        .where(and(eq(folder.id, k.id), eq(folder.ownerId, user.id))),
    ),
    ...kidsB.map((k, i) =>
      db
        .update(bookmark)
        .set({ folderId: null, sortOrder: base.b + i + 1, updatedAt: now })
        .where(and(eq(bookmark.id, k.id), eq(bookmark.ownerId, user.id))),
    ),
    db
      .update(folder)
      .set({ deletedAt: now, deleteBatchId: randomUUID(), updatedAt: now })
      .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const, projects: kidsF.length, bookmarks: kidsB.length };
}

const folderInput = z.object({
  name: z.string().trim().min(1).max(200),
  parentId: z.uuid().nullable(),
  isProject: z.boolean(),
});

export async function createFolder(raw: unknown) {
  const user = await requireUser();
  const p = folderInput.safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Give the folder a name." };
  const { name, parentId } = p.data;
  if (parentId && !(await ownedFolder(user.id, parentId))) return { ok: false as const, error: "Parent folder not found." };
  const [m] = await db
    .select({ m: sql<number>`coalesce(max(${folder.sortOrder}), 0)` })
    .from(folder)
    .where(and(eq(folder.ownerId, user.id), parentId ? eq(folder.parentId, parentId) : isNull(folder.parentId)));
  const [row] = await db
    .insert(folder)
    .values({ ownerId: user.id, parentId, name, isProject: !parentId && p.data.isProject, sortOrder: Number(m?.m ?? 0) + 1 })
    .returning({ id: folder.id });
  revalidatePath("/", "layout");
  return { ok: true as const, id: row.id };
}

export async function renameFolder(id: string, name: string) {
  const user = await requireUser();
  const n = z.string().trim().min(1).max(200).safeParse(name);
  if (!z.uuid().safeParse(id).success || !n.success) return { ok: false as const, error: "Give the folder a name." };
  const rows = await db
    .update(folder)
    .set({ name: n.data, updatedAt: new Date() })
    .where(and(eq(folder.id, id), eq(folder.ownerId, user.id), isNull(folder.deletedAt)))
    .returning({ id: folder.id });
  revalidatePath("/", "layout");
  return rows.length ? { ok: true as const } : { ok: false as const, error: "Folder not found." };
}

export async function setPinned(folderId: string, value: boolean) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const };
  const rows = await db
    .update(folder)
    .set({ pinnedAt: value ? new Date() : null })
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)))
    .returning({ id: folder.id });
  revalidatePath("/", "layout");
  return { ok: rows.length === 1 };
}
