import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BookmarkView, Crumb, FolderView } from "./types";

const { folder, bookmark } = schema;

/* Every query below is scoped to ownerId and ignores trashed rows. */

// Drizzle drops the table name from columns in single-table selects, so the
// correlated sub-queries reference the outer row explicitly.
const outerId = sql.raw(`"folder"."id"`);

function folderSelect(ownerId: string) {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    icon: folder.icon,
    isProject: folder.isProject,
    coverUrl: sql<string | null>`case when ${folder.coverImageId} is null then null else '/api/images/' || ${folder.coverImageId} end`,
    bookmarkCount: sql<number>`(select count(*)::int from ${bookmark} b
      where b.folder_id = ${outerId} and b.owner_id = ${ownerId} and b.deleted_at is null)`,
    launchCount: sql<number>`(select count(*)::int from ${bookmark} b
      where b.folder_id = ${outerId} and b.owner_id = ${ownerId} and b.deleted_at is null and b.launch_on_start)`,
    subfolderCount: sql<number>`(select count(*)::int from ${folder} c
      where c.parent_id = ${outerId} and c.owner_id = ${ownerId} and c.deleted_at is null)`,
  };
}

const bookmarkSelect = {
  id: bookmark.id,
  folderId: bookmark.folderId,
  title: bookmark.title,
  url: bookmark.url,
  domain: bookmark.domain,
  faviconUrl: bookmark.faviconUrl,
  description: bookmark.description,
  thumbnailUrl: bookmark.thumbnailUrl,
  launchOnStart: bookmark.launchOnStart,
};

async function childFolders(ownerId: string, parentId: string | null): Promise<FolderView[]> {
  return db
    .select(folderSelect(ownerId))
    .from(folder)
    .where(
      and(
        eq(folder.ownerId, ownerId),
        isNull(folder.deletedAt),
        parentId ? eq(folder.parentId, parentId) : isNull(folder.parentId),
      ),
    )
    .orderBy(asc(folder.sortOrder), asc(folder.createdAt));
}

async function childBookmarks(ownerId: string, folderId: string | null): Promise<BookmarkView[]> {
  return db
    .select(bookmarkSelect)
    .from(bookmark)
    .where(
      and(
        eq(bookmark.ownerId, ownerId),
        isNull(bookmark.deletedAt),
        folderId ? eq(bookmark.folderId, folderId) : isNull(bookmark.folderId),
      ),
    )
    .orderBy(asc(bookmark.sortOrder), asc(bookmark.createdAt));
}

export async function getRoot(ownerId: string) {
  const [folders, bookmarks] = await Promise.all([childFolders(ownerId, null), childBookmarks(ownerId, null)]);
  return {
    projects: folders.filter((f) => f.isProject),
    library: folders.filter((f) => !f.isProject),
    bookmarks,
  };
}

export async function getFolder(ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [current] = await db
    .select(folderSelect(ownerId))
    .from(folder)
    .where(and(eq(folder.id, id), eq(folder.ownerId, ownerId), isNull(folder.deletedAt)));
  if (!current) return null;

  const chain = await db.execute<{ id: string; name: string; depth: number }>(sql`
    with recursive up as (
      select id, parent_id, name, 0 as depth from ${folder} where id = ${id} and owner_id = ${ownerId}
      union all
      select f.id, f.parent_id, f.name, up.depth + 1 from ${folder} f
      join up on f.id = up.parent_id where f.owner_id = ${ownerId}
    )
    select id, name, depth from up order by depth desc`);
  const rows = "rows" in chain ? chain.rows : (chain as unknown as { id: string; name: string }[]);
  const crumbs: Crumb[] = [{ id: null, name: "Home" }, ...rows.map((r) => ({ id: r.id, name: r.name }))];

  const [subfolders, bookmarks] = await Promise.all([childFolders(ownerId, id), childBookmarks(ownerId, id)]);
  return { folder: current, subfolders, bookmarks, crumbs };
}

/** Flat list of all folders, for destination pickers. */
export async function getFolderTree(ownerId: string) {
  return db
    .select({ id: folder.id, parentId: folder.parentId, name: folder.name })
    .from(folder)
    .where(and(eq(folder.ownerId, ownerId), isNull(folder.deletedAt)))
    .orderBy(asc(folder.sortOrder), asc(folder.createdAt));
}

export async function getExistingUrls(ownerId: string) {
  const rows = await db
    .select({ url: bookmark.url })
    .from(bookmark)
    .where(and(eq(bookmark.ownerId, ownerId), isNull(bookmark.deletedAt)));
  return rows.map((r) => r.url);
}
