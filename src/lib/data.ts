import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
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
    pinned: sql<boolean>`exists (select 1 from ${schema.topItem} ti where ti.folder_id = ${outerId} and ti.owner_id = ${ownerId})`,
    coverUrl: sql<string | null>`case when ${folder.coverImageId} is null then null else '/api/images/' || ${folder.coverImageId} end`,
    iconUrl: sql<string | null>`case when ${folder.iconImageId} is null then null else '/api/images/' || ${folder.iconImageId} end`,
    bookmarkCount: sql<number>`(select count(*)::int from ${bookmark} b
      where b.folder_id = ${outerId} and b.owner_id = ${ownerId} and b.deleted_at is null)`,
    launchCount: sql<number>`(select count(*)::int from ${bookmark} b
      where b.folder_id = ${outerId} and b.owner_id = ${ownerId} and b.deleted_at is null and b.launch_on_start)`,
    subfolderCount: sql<number>`(select count(*)::int from ${folder} c
      where c.parent_id = ${outerId} and c.owner_id = ${ownerId} and c.deleted_at is null)`,
    lastModified: sql<string | null>`(
      with recursive t(id) as (
        select ${outerId}
        union all
        select c.id from ${folder} c join t on c.parent_id = t.id
        where c.owner_id = ${ownerId} and c.deleted_at is null
      )
      select greatest(
        (select max(f2.updated_at) from ${folder} f2 where f2.id in (select id from t)),
        (select max(b.updated_at) from ${bookmark} b
          where b.folder_id in (select id from t) and b.owner_id = ${ownerId} and b.deleted_at is null)
      ))`,
    lastLaunchedAt: folder.lastLaunchedAt,
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
  updatedAt: bookmark.updatedAt,
  lastLaunchedAt: bookmark.lastLaunchedAt,
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

/** Whole collection (minus Trash) for the Organize screen. */
export async function getFullTree(ownerId: string) {
  const [folders, bookmarks] = await Promise.all([
    db
      .select({ id: folder.id, parentId: folder.parentId, name: folder.name, isProject: folder.isProject })
      .from(folder)
      .where(and(eq(folder.ownerId, ownerId), isNull(folder.deletedAt)))
      .orderBy(asc(folder.sortOrder), asc(folder.createdAt)),
    db
      .select({ id: bookmark.id, folderId: bookmark.folderId, title: bookmark.title, domain: bookmark.domain, faviconUrl: bookmark.faviconUrl })
      .from(bookmark)
      .where(and(eq(bookmark.ownerId, ownerId), isNull(bookmark.deletedAt)))
      .orderBy(asc(bookmark.sortOrder), asc(bookmark.createdAt)),
  ]);
  return { folders, bookmarks };
}

export type TrashBatch = {
  batch: string;
  deletedAt: string;
  top: { type: "f" | "b"; name: string }[];
  folders: number;
  links: number;
};

/** Trash, grouped by what was deleted together (one row per delete / undone import). */
export async function getTrash(ownerId: string): Promise<TrashBatch[]> {
  const rowsOf = <T,>(r: unknown): T[] => (r && typeof r === "object" && "rows" in r ? (r as { rows: T[] }).rows : (r as T[]));
  const [topRes, countRes] = await Promise.all([
    db.execute(sql`
      select 'f' as type, f.name as name, f.delete_batch_id as batch, f.deleted_at as deleted_at
      from ${folder} f left join ${folder} p on p.id = f.parent_id
      where f.owner_id = ${ownerId} and f.deleted_at is not null and f.delete_batch_id is not null
        and (p.id is null or p.delete_batch_id is distinct from f.delete_batch_id)
      union all
      select 'b', b.title, b.delete_batch_id, b.deleted_at
      from ${bookmark} b left join ${folder} p on p.id = b.folder_id
      where b.owner_id = ${ownerId} and b.deleted_at is not null and b.delete_batch_id is not null
        and (p.id is null or p.delete_batch_id is distinct from b.delete_batch_id)
      order by deleted_at desc`),
    db.execute(sql`
      select batch, sum(fc)::int as folders, sum(bc)::int as links from (
        select delete_batch_id as batch, 1 as fc, 0 as bc from ${folder} where owner_id = ${ownerId} and deleted_at is not null
        union all
        select delete_batch_id, 0, 1 from ${bookmark} where owner_id = ${ownerId} and deleted_at is not null
      ) x where batch is not null group by batch`),
  ]);
  const counts = new Map(rowsOf<{ batch: string; folders: number; links: number }>(countRes).map((r) => [r.batch, r]));
  const map = new Map<string, TrashBatch>();
  for (const r of rowsOf<{ type: "f" | "b"; name: string; batch: string; deleted_at: string | Date }>(topRes)) {
    let b = map.get(r.batch);
    if (!b) {
      const c = counts.get(r.batch);
      b = {
        batch: r.batch,
        deletedAt: new Date(r.deleted_at).toISOString(),
        top: [],
        folders: Number(c?.folders ?? 0),
        links: Number(c?.links ?? 0),
      };
      map.set(r.batch, b);
    }
    b.top.push({ type: r.type, name: r.name });
  }
  return [...map.values()].slice(0, 300);
}

export type TopItemView = {
  id: string;
  kind: "link" | "folder";
  /** What shows in the bar (custom title, or the folder's name). */
  title: string;
  customTitle: string | null;
  url: string | null;
  folderId: string | null;
  iconUrl: string | null;
  hasCustomIcon: boolean;
  links: { id: string; title: string; url: string; domain: string; faviconUrl: string | null }[];
  subfolders: { id: string; name: string }[];
};

/** The editable top bar, in order. Folders in Trash are left out. */
export async function getTopBar(ownerId: string): Promise<TopItemView[]> {
  const { topItem } = schema;
  const items = await db
    .select({
      id: topItem.id,
      kind: topItem.kind,
      title: topItem.title,
      url: topItem.url,
      folderId: topItem.folderId,
      favicon: topItem.favicon,
      iconImageId: topItem.iconImageId,
      folderName: folder.name,
      folderIcon: folder.iconImageId,
      folderDeleted: folder.deletedAt,
    })
    .from(topItem)
    .leftJoin(folder, eq(folder.id, topItem.folderId))
    .where(eq(topItem.ownerId, ownerId))
    .orderBy(asc(topItem.sortOrder), asc(topItem.createdAt));
  const live = items.filter((i) => i.kind === "link" || (i.folderId && !i.folderDeleted));
  const ids = live.flatMap((i) => (i.kind === "folder" && i.folderId ? [i.folderId] : []));

  const [links, subs] = ids.length
    ? await Promise.all([
        db
          .select({ id: bookmark.id, folderId: bookmark.folderId, title: bookmark.title, url: bookmark.url, domain: bookmark.domain, faviconUrl: bookmark.faviconUrl })
          .from(bookmark)
          .where(and(eq(bookmark.ownerId, ownerId), isNull(bookmark.deletedAt), inArray(bookmark.folderId, ids)))
          .orderBy(asc(bookmark.sortOrder), asc(bookmark.createdAt)),
        db
          .select({ id: folder.id, parentId: folder.parentId, name: folder.name })
          .from(folder)
          .where(and(eq(folder.ownerId, ownerId), isNull(folder.deletedAt), inArray(folder.parentId, ids)))
          .orderBy(asc(folder.sortOrder), asc(folder.createdAt)),
      ])
    : [[], []];

  return live.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title ?? i.folderName ?? "Link",
    customTitle: i.title,
    url: i.url,
    folderId: i.folderId,
    iconUrl: i.iconImageId
      ? `/api/images/${i.iconImageId}`
      : i.kind === "link"
        ? i.favicon
        : i.folderIcon
          ? `/api/images/${i.folderIcon}`
          : null,
    hasCustomIcon: !!i.iconImageId,
    links: links
      .filter((l) => l.folderId === i.folderId)
      .map((l) => ({ id: l.id, title: l.title, url: l.url, domain: l.domain, faviconUrl: l.faviconUrl })),
    subfolders: subs.filter((x) => x.parentId === i.folderId).map((x) => ({ id: x.id, name: x.name })),
  }));
}
