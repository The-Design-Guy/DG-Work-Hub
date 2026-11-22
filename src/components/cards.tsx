"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { removeFolderCover, setFolderCover } from "@/app/actions/folders";
import { resizeImage } from "@/lib/resize-image";
import {
  ArrowRightLeft,
  Copy,
  ExternalLink,
  Folder as FolderIcon,
  Image as ImageIcon,
  ImageOff,
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

function Favicon({ src, letter }: { src: string | null; letter: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{letter}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-9 w-9 [image-rendering:auto]" onError={() => setFailed(true)} />;
}

/* ------------------------------------------------------------------ */

export function FolderCard({ folder, onAction }: { folder: FolderView; onAction?: (a: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState(folder.coverUrl);
  const [busy, setBusy] = useState(false);
  const [prevUrl, setPrevUrl] = useState(folder.coverUrl);
  if (folder.coverUrl !== prevUrl) {
    setPrevUrl(folder.coverUrl);
    setCover(folder.coverUrl);
  }
  const hue = hueFor(folder.name);

  const parts = [
    `${folder.bookmarkCount} ${folder.bookmarkCount === 1 ? "link" : "links"}`,
    folder.subfolderCount ? `${folder.subfolderCount} ${folder.subfolderCount === 1 ? "folder" : "folders"}` : null,
  ].filter(Boolean);

  async function upload(file: File) {
    setBusy(true);
    const before = cover;
    try {
      const { blob, width, height } = await resizeImage(file);
      setCover(URL.createObjectURL(blob));
      const form = new FormData();
      form.set("file", blob, "cover");
      form.set("width", String(width));
      form.set("height", String(height));
      const res = await setFolderCover(folder.id, form);
      if (!res.ok) throw new Error(res.error);
      toast.success("Cover updated");
    } catch (e) {
      setCover(before);
      toast.error(e instanceof Error ? e.message : "Couldn't update the cover.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCover() {
    const before = cover;
    setCover(null);
    const res = await removeFolderCover(folder.id);
    if (!res.ok) {
      setCover(before);
      toast.error("Couldn't remove the cover.");
    }
  }

  return (
    <article className="card group relative flex flex-col overflow-hidden">
      <div
        className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9]"
        style={{
          background: `radial-gradient(120% 120% at 0% 0%, hsl(${hue} 20% 20%) 0%, #1d2025 60%, #17191d 100%)`,
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className={cn("h-full w-full object-cover transition-opacity", busy && "opacity-60")} />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/6 text-3xl ring-1 ring-white/10 sm:h-16 sm:w-16 sm:text-4xl" aria-hidden>
              {folder.icon ?? <FolderIcon className="h-7 w-7 text-accent sm:h-8 sm:w-8" />}
            </div>
          </div>
        )}
        <div className="absolute right-2 top-2 z-10 rounded-lg bg-black/45 backdrop-blur">
          <Menu trigger={menuTrigger(`Actions for ${folder.name}`)}>
            <MenuItem icon={<ImageIcon />} onSelect={() => fileRef.current?.click()}>
              {cover ? "Change cover image" : "Add cover image"}
            </MenuItem>
            {cover && (
              <MenuItem icon={<ImageOff />} onSelect={removeCover}>
                Remove cover
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={<Pencil />} onSelect={() => onAction?.("rename")}>Rename</MenuItem>
            <MenuItem icon={<ArrowRightLeft />} onSelect={() => onAction?.("move")}>Move / reorder</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => onAction?.("delete")}>Move to Trash</MenuItem>
          </Menu>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-5">
        <h3 className="truncate text-base font-semibold sm:text-lg">
          <Link href={`/f/${folder.id}`} dir="auto" className="stretched-link focus-visible:outline-none">
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
              <Favicon src={bookmark.faviconUrl} letter={letter} />
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
