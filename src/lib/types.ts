/** View models used by the UI. Step 3 maps database rows onto these. */

export type FolderView = {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  coverUrl: string | null;
  iconUrl: string | null;
  isProject: boolean;
  bookmarkCount: number;
  launchCount: number;
  subfolderCount: number;
};

export type BookmarkView = {
  id: string;
  folderId: string | null;
  title: string;
  url: string;
  domain: string;
  faviconUrl: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  launchOnStart: boolean;
};

export type Crumb = { id: string | null; name: string };
