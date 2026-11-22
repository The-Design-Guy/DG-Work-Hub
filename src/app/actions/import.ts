"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { normalizeUrl, safeIconDataUri } from "@/lib/url";

const { folder, bookmark } = schema;

const MAX_NODES = 20_000;
const MAX_DEPTH = 60;
const CHUNK = 500;

type Node =
  | { t: "f"; title: string; children: Node[] }
  | { t: "l"; title: string; url: string; icon?: string | null };

const node: z.ZodType<Node> = z.lazy(() =>
  z.union([
    z.object({ t: z.literal("f"), title: z.string().max(500), children: z.array(node) }),
    z.object({
      t: z.literal("l"),
      title: z.string().max(1000),
      url: z.string().max(4096),
      icon: z.string().max(16_000).nullable().optional(),
    }),
  ]),
);

const input = z.object({
  destination: z.discriminatedUnion("type", [
    z.object({ type: z.literal("root") }),
    z.object({ type: z.literal("folder"), id: z.uuid() }),
    z.object({ type: z.literal("new"), name: z.string().trim().min(1).max(200), parentId: z.uuid().nullable() }),
  ]),
  nodes: z.array(node).max(MAX_NODES),
});

export type ImportInput = z.infer<typeof input>;
export type ImportResult =
  | { ok: true; importId: string; folders: number; bookmarks: number; skipped: number; destinationId: string | null }
  | { ok: false; error: string };

async function ownedFolder(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.id, id), eq(folder.ownerId, ownerId), isNull(folder.deletedAt)));
  return !!row;
}

async function nextOrder(ownerId: string, parentId: string | null) {
  const [f] = await db
    .select({ m: sql<number>`coalesce(max(${folder.sortOrder}), 0)` })
    .from(folder)
    .where(and(eq(folder.ownerId, ownerId), parentId ? eq(folder.parentId, parentId) : isNull(folder.parentId)));
  const [b] = await db
    .select({ m: sql<number>`coalesce(max(${bookmark.sortOrder}), 0)` })
    .from(bookmark)
    .where(and(eq(bookmark.ownerId, ownerId), parentId ? eq(bookmark.folderId, parentId) : isNull(bookmark.folderId)));
  return { folder: Number(f?.m ?? 0) + 1, bookmark: Number(b?.m ?? 0) + 1 };
}

export async function importBookmarks(raw: unknown): Promise<ImportResult> {
  const user = await requireUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "The import data is invalid or too large." };
  const { destination, nodes } = parsed.data;

  const importId = randomUUID();
  const now = new Date();
  const folderRows: (typeof folder.$inferInsert)[] = [];
  const bookmarkRows: (typeof bookmark.$inferInsert)[] = [];
  let skipped = 0;
  let count = 0;

  // Resolve where the import lands.
  let destId: string | null = null;
  if (destination.type === "folder") {
    if (!(await ownedFolder(user.id, destination.id))) return { ok: false, error: "Destination folder not found." };
    destId = destination.id;
  } else if (destination.type === "new") {
    if (destination.parentId && !(await ownedFolder(user.id, destination.parentId))) {
      return { ok: false, error: "Parent folder not found." };
    }
    const start = await nextOrder(user.id, destination.parentId);
    destId = randomUUID();
    folderRows.push({
      id: destId,
      ownerId: user.id,
      parentId: destination.parentId,
      name: destination.name,
      sortOrder: start.folder,
      importId,
      createdAt: now,
      updatedAt: now,
    });
  }

  const start = destination.type === "new" ? { folder: 1, bookmark: 1 } : await nextOrder(user.id, destId);

  // Breadth-first so every parent row is inserted before its children.
  const queue: { nodes: Node[]; parentId: string | null; depth: number; fo: number; bo: number }[] = [
    { nodes, parentId: destId, depth: 0, fo: start.folder, bo: start.bookmark },
  ];
  while (queue.length) {
    const level = queue.shift()!;
    if (level.depth > MAX_DEPTH) return { ok: false, error: "Folders are nested too deeply." };
    let fo = level.fo;
    let bo = level.bo;
    for (const n of level.nodes) {
      if (++count > MAX_NODES) return { ok: false, error: "Too many items in one import." };
      if (n.t === "f") {
        const id = randomUUID();
        folderRows.push({
          id,
          ownerId: user.id,
          parentId: level.parentId,
          name: n.title.trim() || "Untitled folder",
          sortOrder: fo++,
          importId,
          createdAt: now,
          updatedAt: now,
        });
        queue.push({ nodes: n.children, parentId: id, depth: level.depth + 1, fo: 1, bo: 1 });
      } else {
        const norm = normalizeUrl(n.url);
        if (!norm) {
          skipped++;
          continue;
        }
        bookmarkRows.push({
          ownerId: user.id,
          folderId: level.parentId,
          title: n.title.trim() || norm.domain,
          url: norm.url,
          domain: norm.domain,
          faviconUrl: safeIconDataUri(n.icon),
          sortOrder: bo++,
          importId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  if (!folderRows.length && !bookmarkRows.length) return { ok: false, error: "Nothing to import." };

  const queries = [];
  for (let i = 0; i < folderRows.length; i += CHUNK) queries.push(db.insert(folder).values(folderRows.slice(i, i + CHUNK)));
  for (let i = 0; i < bookmarkRows.length; i += CHUNK) {
    queries.push(db.insert(bookmark).values(bookmarkRows.slice(i, i + CHUNK)));
  }

  try {
    await atomic(queries);
  } catch (e) {
    console.error("import failed", e);
    return { ok: false, error: "Import failed. Nothing was saved." };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    importId,
    folders: folderRows.length,
    bookmarks: bookmarkRows.length,
    skipped,
    destinationId: destId,
  };
}

/** Moves everything from one import to Trash (recoverable). */
export async function undoImport(importId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(importId).success) return { ok: false as const };
  const now = new Date();
  await atomic([
    db
      .update(bookmark)
      .set({ deletedAt: now, deleteBatchId: importId })
      .where(and(eq(bookmark.importId, importId), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt))),
    db
      .update(folder)
      .set({ deletedAt: now, deleteBatchId: importId })
      .where(and(eq(folder.importId, importId), eq(folder.ownerId, user.id), isNull(folder.deletedAt))),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
