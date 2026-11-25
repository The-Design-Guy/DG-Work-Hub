/** View models used by the UI. Step 3 maps database rows onto these. */

export type FolderView = {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  coverUrl: string | null;
  iconUrl: string | null;
  isProject: boolean;
  spaceId: string | null;
  pinned: boolean;
  bookmarkCount: number;
  launchCount: number;
  subfolderCount: number;
  /** Latest change to the folder or anything inside it, at any depth. */
  lastModified: Date | string | null;
  lastLaunchedAt: Date | string | null;
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
  spaceId: string | null;
  updatedAt: Date | string;
  lastLaunchedAt: Date | string | null;
};

export type Crumb = { id: string | null; name: string };

export type Sort = "custom" | "az" | "za" | "modified" | "launched";

export type SpaceView = { id: string; name: string };
