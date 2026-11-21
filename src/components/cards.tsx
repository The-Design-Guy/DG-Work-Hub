"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  Copy,
  ExternalLink,
  Folder as FolderIcon,
  MoreHorizontal,
  Pencil,
  Rocket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { BookmarkView, FolderView } from "@/lib/types";
import { Menu, MenuItem, MenuSeparator } from "./ui/menu";
import { cn } from "./ui/button";

function hueFor(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

const menuTrigger = (label: string) => (
  <button
    type="button"
    aria-label={label}
    className="relative z-10 grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-text data-[state=open]:bg-elevated data-[state=open]:text-text"
  >
    <MoreHorizontal className="h-5 w-5" />
  </button>
);

/* ------------------------------------------------------------------ */

export function FolderCard({ folder, onAction }: { folder: FolderView; onAction?: (a: string) => void }) {
  const parts = [
    `${folder.bookmarkCount} ${folder.bookmarkCount === 1 ? "link" : "links"}`,
    folder.subfolderCount ? `${folder.subfolderCount} ${folder.subfolderCount === 1 ? "folder" : "folders"}` : null,
  ].filter(Boolean);

  return (
    <article className="card group relative flex min-h-40 flex-col p-4 sm:min-h-48 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-elevated text-3xl sm:h-16 sm:w-16 sm:text-4xl" aria-hidden>
          {folder.icon ?? <FolderIcon className="h-7 w-7 text-accent" />}
        </div>
        <Menu trigger={menuTrigger(`Actions for ${folder.name}`)}>
          <MenuItem icon={<Pencil />} onSelect={() => onAction?.("rename")}>Rename</MenuItem>
          <MenuItem icon={<ArrowRightLeft />} onSelect={() => onAction?.("move")}>Move / reorder</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} danger onSelect={() => onAction?.("delete")}>Move to Trash</MenuItem>
        </Menu>
      </div>
      <h3 className="mt-auto truncate pt-4 text-base font-semibold sm:pt-6 sm:text-xl">
        <Link href={`/f/${folder.id}`} className="stretched-link focus-visible:outline-none">
          {folder.name}
        </Link>
      </h3>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted sm:gap-3 sm:text-sm">
        <span className="truncate">{parts.join(" · ")}</span>
        {folder.launchCount > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent"
            title={`${folder.launchCount} launch links`}
          >
            <Rocket className="h-3.5 w-3.5" aria-hidden />
            {folder.launchCount}
          </span>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function BookmarkCard({
  bookmark,
  onToggleLaunch,
  onAction,
}: {
  bookmark: BookmarkView;
  onToggleLaunch?: (id: string, next: boolean) => void;
  onAction?: (a: string) => void;
}) {
  const hue = hueFor(bookmark.domain);
  const letter = (bookmark.title || bookmark.domain).trim().charAt(0).toUpperCase();

  return (
    <article className={cn("card group relative flex flex-col overflow-hidden", bookmark.launchOnStart && "card-launch")}>
      {/* Preview */}
      <div
        className="relative aspect-[16/7] w-full sm:aspect-[16/9] overflow-hidden"
        style={{
          background: `radial-gradient(120% 120% at 0% 0%, hsl(${hue} 45% 22%) 0%, hsl(${hue} 30% 12%) 55%, #15171a 100%)`,
        }}
      >
        {bookmark.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bookmark.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/8 font-heading text-3xl font-semibold text-white/90 ring-1 ring-white/10 backdrop-blur">
              {bookmark.faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bookmark.faviconUrl} alt="" className="h-9 w-9" />
              ) : (
                letter
              )}
            </div>
          </div>
        )}

        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <button
            type="button"
            aria-pressed={bookmark.launchOnStart}
            aria-label={bookmark.launchOnStart ? "Remove from Launch Workspace" : "Add to Launch Workspace"}
            title={bookmark.launchOnStart ? "In Launch Workspace" : "Add to Launch Workspace"}
            onClick={() => onToggleLaunch?.(bookmark.id, !bookmark.launchOnStart)}
            className={cn(
              "relative z-10 grid h-9 w-9 place-items-center rounded-lg backdrop-blur transition-colors",
              bookmark.launchOnStart
                ? "bg-accent text-black hover:bg-accent-hover"
                : "bg-black/45 text-white/80 hover:bg-black/70 hover:text-white",
            )}
          >
            <Rocket className="h-4.5 w-4.5" />
          </button>
          <div className="rounded-lg bg-black/45 backdrop-blur">
            <Menu trigger={menuTrigger(`Actions for ${bookmark.title}`)}>
              <MenuItem
                icon={<ExternalLink />}
                onSelect={() => window.open(bookmark.url, "_blank", "noopener,noreferrer")}
              >
                Open
              </MenuItem>
              <MenuItem
                icon={<Copy />}
                onSelect={async () => {
                  await navigator.clipboard.writeText(bookmark.url);
                  toast.success("Link copied");
                }}
              >
                Copy link
              </MenuItem>
              <MenuItem icon={<Pencil />} onSelect={() => onAction?.("edit")}>Edit</MenuItem>
              <MenuItem icon={<ArrowRightLeft />} onSelect={() => onAction?.("move")}>Move / reorder</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onSelect={() => onAction?.("delete")}>Move to Trash</MenuItem>
            </Menu>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-semibold">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="stretched-link focus-visible:outline-none"
          >
            {bookmark.title}
          </a>
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted">{bookmark.domain}</p>
        {bookmark.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted/90">{bookmark.description}</p>
        )}
      </div>
    </article>
  );
}
