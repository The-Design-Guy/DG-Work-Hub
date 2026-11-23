import type { BookmarkView } from "./types";

/** Quick links in the top bar. Becomes editable ("pin to top bar") in a later step. */
const pin = (id: string, title: string, url: string): BookmarkView => ({
  id,
  folderId: null,
  title,
  url,
  domain: new URL(url).hostname,
  faviconUrl: null,
  description: null,
  thumbnailUrl: null,
  launchOnStart: false,
});

export const pinnedLinks: BookmarkView[] = [
  pin("p1", "GitHub repos", "https://github.com/The-Design-Guy?tab=repositories"),
  pin("p2", "Vercel projects", "https://vercel.com/atlas-zb-project"),
  pin("p3", "To-Do 2026", "https://trello.com/b/qgVUTsn7/to-do-2026"),
  pin("p4", "OpenAI Billing", "https://platform.openai.com/settings/organization/billing/overview"),
];
