"use server";

import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { folder, bookmark } = schema;

export type SearchResult = {
  folders: { id: string; name: string; path: string }[];
  links: { id: string; title: string; url: string; domain: string; faviconUrl: string | null; folderId: string | null; path: string }[];
};

/** Global search across folder names, link titles, domains, URLs and descriptions. */
export async function searchAll(raw: string): Promise<SearchResult> {
  const user = await requireUser();
  const q = raw.trim().slice(0, 100);
  if (!q) return { folders: [], links: [] };
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const [allFolders, links] = await Promise.all([
    db
      .select({ id: folder.id, parentId: folder.parentId, name: folder.name })
      .from(folder)
      .where(and(eq(folder.ownerId, user.id), isNull(folder.deletedAt))),
    db
      .select({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        domain: bookmark.domain,
        faviconUrl: bookmark.faviconUrl,
        folderId: bookmark.folderId,
      })
      .from(bookmark)
      .where(
        and(
          eq(bookmark.ownerId, user.id),
          isNull(bookmark.deletedAt),
          or(ilike(bookmark.title, like), ilike(bookmark.domain, like), ilike(bookmark.url, like), ilike(bookmark.description, like)),
        ),
      )
      .limit(60),
  ]);

  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const pathOf = (id: string | null) => {
    const names: string[] = [];
    let cur = id ? byId.get(id) : undefined;
    let guard = 0;
    while (cur && guard++ < 50) {
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return ["Home", ...names].join(" › ");
  };

  const ql = q.toLowerCase();
  const score = (text: string) => (text.toLowerCase().startsWith(ql) ? 0 : text.toLowerCase().includes(ql) ? 1 : 2);

  const folders = allFolders
    .filter((f) => f.name.toLowerCase().includes(ql))
    .sort((a, b) => score(a.name) - score(b.name) || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((f) => ({ id: f.id, name: f.name, path: pathOf(f.parentId) }));

  return {
    folders,
    links: links
      .sort((a, b) => score(a.title) - score(b.title) || score(a.domain) - score(b.domain))
      .slice(0, 12)
      .map((l) => ({ ...l, path: pathOf(l.folderId) })),
  };
}
