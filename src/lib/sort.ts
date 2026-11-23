import type { BookmarkView, FolderView, Sort } from "./types";

const collator = new Intl.Collator(["en", "he"], { numeric: true, sensitivity: "base" });
const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : -Infinity);

export function sortFolders(list: FolderView[], sort: Sort) {
  if (sort === "custom") return list;
  const out = [...list];
  if (sort === "az") out.sort((a, b) => collator.compare(a.name, b.name));
  if (sort === "za") out.sort((a, b) => collator.compare(b.name, a.name));
  if (sort === "modified") out.sort((a, b) => time(b.lastModified) - time(a.lastModified));
  if (sort === "launched") out.sort((a, b) => time(b.lastLaunchedAt) - time(a.lastLaunchedAt) || collator.compare(a.name, b.name));
  return out;
}

export function sortBookmarks(list: BookmarkView[], sort: Sort) {
  if (sort === "custom") return list;
  const out = [...list];
  if (sort === "az") out.sort((a, b) => collator.compare(a.title, b.title));
  if (sort === "za") out.sort((a, b) => collator.compare(b.title, a.title));
  if (sort === "modified") out.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
  if (sort === "launched") out.sort((a, b) => time(b.lastLaunchedAt) - time(a.lastLaunchedAt) || collator.compare(a.title, b.title));
  return out;
}
