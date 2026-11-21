/**
 * TEMPORARY sample data for the step-2 design review.
 * Removed in step 3, when real data comes from the database.
 */
import type { BookmarkView, Crumb, FolderView } from "./types";

const f = (
  id: string,
  parentId: string | null,
  name: string,
  icon: string,
  bookmarkCount: number,
  launchCount = 0,
  subfolderCount = 0,
): FolderView => ({ id, parentId, name, icon, bookmarkCount, launchCount, subfolderCount });

export const mockFolders: FolderView[] = [
  f("bookreator", null, "BOOKREATOR", "📚", 7, 5, 1),
  f("design-guy", null, "Design Guy", "🕶️", 12, 3, 2),
  f("web3d", null, "Web3D", "🧊", 18, 4, 3),
  f("huliot", null, "Huliot", "📦", 9, 2),
  f("ai-tools", null, "AI Tools", "✨", 24, 0, 4),
  f("store", null, "Fashion Store", "🧢", 6, 0),
  f("inspo", null, "Inspiration", "🎨", 31, 0, 5),
  f("bookreator-assets", "bookreator", "Assets & References", "🗂️", 4, 0),
];

const b = (
  id: string,
  folderId: string,
  title: string,
  url: string,
  launchOnStart = false,
  description: string | null = null,
): BookmarkView => ({
  id,
  folderId,
  title,
  url,
  domain: new URL(url).hostname.replace(/^www\./, ""),
  faviconUrl: null,
  description,
  thumbnailUrl: null,
  launchOnStart,
});

export const mockBookmarks: BookmarkView[] = [
  b("b1", "bookreator", "ChatGPT project", "https://chatgpt.com/g/project", true, "Story drafts and character prompts"),
  b("b2", "bookreator", "Claude Design — Bookreator", "https://claude.ai/design", true),
  b("b3", "bookreator", "Claude chat", "https://claude.ai/project/bookreator", true, "Main working thread"),
  b("b4", "bookreator", "Wix editor", "https://manage.wix.com/editor", true),
  b("b5", "bookreator", "Google Drive folder", "https://drive.google.com/drive/folders/bookreator", true, "Assets, exports and contracts"),
  b("b6", "bookreator", "Competitor: StoryBird", "https://storybird.com"),
  b("b7", "bookreator", "Print-on-demand pricing", "https://www.lulu.com/pricing"),
];

export const mockPinned: BookmarkView[] = [
  b("p1", "pinned", "GitHub repos", "https://github.com/The-Design-Guy?tab=repositories"),
  b("p2", "pinned", "Vercel projects", "https://vercel.com/atlas-zb-project"),
];

export function mockFolder(id: string) {
  const folder = mockFolders.find((x) => x.id === id) ?? null;
  const subfolders = mockFolders.filter((x) => x.parentId === id);
  const bookmarks = mockBookmarks.filter((x) => x.folderId === id);
  const crumbs: Crumb[] = [{ id: null, name: "Home" }];
  const chain: FolderView[] = [];
  let cur = folder;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? (mockFolders.find((x) => x.id === cur!.parentId) ?? null) : null;
  }
  chain.forEach((c) => crumbs.push({ id: c.id, name: c.name }));
  return { folder, subfolders, bookmarks, crumbs };
}
