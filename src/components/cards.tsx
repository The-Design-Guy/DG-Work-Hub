"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { removeFolderCover, setFolderCover, setProject, subfoldersToProjects, unpackFolder } from "@/app/actions/folders";
import { restoreBatch, trashBookmark, trashFolder } from "@/app/actions/trash";
import { Dialog } from "./ui/dialog";
import { IconDialog } from "./icon-dialog";
import { EditBookmarkDialog, RenameFolderDialog } from "./dialogs";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { resizeImage } from "@/lib/resize-image";
import {
  ArrowRightLeft,
  Copy,
  ExternalLink,
  Folder as FolderIcon,
  Image as ImageIcon,
  ImageOff,
  SquareUser,
  FolderOutput,
  Briefcase,
  Library,
  LayoutGrid,
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

function undoToast(message: string, batch: string) {
  toast(message, {
    duration: 8000,
    action: {
      label: "Undo",
      onClick: async () => {
        const res = await restoreBatch(batch);
        if (res.ok) toast.success("Restored");
        else toast.error("Couldn't restore. Check Trash.");
      },
    },
  });
}

function Favicon({ src, letter, small }: { src: string | null; letter: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{letter}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={small ? "h-6 w-6" : "h-9 w-9"} onError={() => setFailed(true)} />;
}

/* ------------------------------------------------------------------ */

export function FolderCard({ folder, variant = "card" }: { folder: FolderView; variant?: "card" | "row" }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState(folder.coverUrl);
  const [iconUrl, setIconUrl] = useState(folder.iconUrl);
  const [iconOpen, setIconOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const router = useRouter();
  const [prevIcon, setPrevIcon] = useState(folder.iconUrl);
  if (folder.iconUrl !== prevIcon) {
    setPrevIcon(folder.iconUrl);
    setIconUrl(folder.iconUrl);
  }
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    text: string;
    cta: string;
    run: () => Promise<string | null>;
  }>(null);
  const [running, setRunning] = useState(false);
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

  const unpackLabel = folder.parentId ? "Move contents up one level" : "Move contents to Home";

  const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;

  function askUnpack() {
    setConfirm({
      title: `${unpackLabel}?`,
      text: `${n(folder.subfolderCount, "folder", "folders")} and ${n(folder.bookmarkCount, "link", "links")} move out of “${folder.name}”. Subfolders keep everything inside them. The empty “${folder.name}” folder goes to Trash.`,
      cta: "Move contents",
      run: async () => {
        const res = await unpackFolder(folder.id);
        if (!res.ok) return res.error;
        toast.success(`Moved ${n(res.folders, "folder", "folders")} and ${n(res.bookmarks, "link", "links")}. “${folder.name}” is in Trash.`);
        return null;
      },
    });
  }

  function askToProjects() {
    setConfirm({
      title: "Turn subfolders into projects?",
      text: `Each of the ${n(folder.subfolderCount, "subfolder", "subfolders")} in “${folder.name}” becomes a project on Home, with everything inside it.${folder.bookmarkCount ? ` ${n(folder.bookmarkCount, "loose link moves", "loose links move")} to Home.` : ""} The empty “${folder.name}” folder goes to Trash.`,
      cta: "Create projects",
      run: async () => {
        const res = await subfoldersToProjects(folder.id);
        if (!res.ok) return res.error;
        toast.success(`${n(res.projects, "project", "projects")} added to Home.`);
        return null;
      },
    });
  }

  function askDelete() {
    const inside = [
      folder.subfolderCount ? n(folder.subfolderCount, "subfolder", "subfolders") : null,
      folder.bookmarkCount ? n(folder.bookmarkCount, "link", "links") : null,
    ].filter(Boolean);
    setConfirm({
      title: `Move “${folder.name}” to Trash?`,
      text: `${inside.length ? `Everything inside goes with it (${inside.join(", ")}, plus anything in subfolders). ` : ""}You can restore it from Trash.`,
      cta: "Move to Trash",
      run: async () => {
        const res = await trashFolder(folder.id);
        if (!res.ok) return "Couldn't delete the folder.";
        undoToast(`“${folder.name}” moved to Trash`, res.batch);
        return null;
      },
    });
  }

  async function toggleProject(value: boolean) {
    const res = await setProject(folder.id, value);
    if (!res.ok) return toast.error("Couldn't update the folder.");
    toast.success(value ? (res.moved ? "Moved to Home as a project" : "Now a project") : "Moved to Library");
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

  const menu = (
    <Menu trigger={menuTrigger(`Actions for ${folder.name}`)}>
            <MenuItem icon={<SquareUser />} onSelect={() => setIconOpen(true)}>
              {iconUrl ? "Change icon" : "Choose icon"}
            </MenuItem>
            <MenuItem icon={<ImageIcon />} onSelect={() => fileRef.current?.click()}>
              {cover ? "Change cover image" : "Add cover image"}
            </MenuItem>
            {cover && (
              <MenuItem icon={<ImageOff />} onSelect={removeCover}>
                Remove cover
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={<Pencil />} onSelect={() => setRenameOpen(true)}>Rename</MenuItem>
            <MenuItem icon={<ArrowRightLeft />} onSelect={() => router.push(`/organize?focus=${folder.id}`)}>Move / reorder</MenuItem>
            <MenuSeparator />
            {folder.isProject ? (
              <MenuItem icon={<Library />} onSelect={() => toggleProject(false)}>Move to Library</MenuItem>
            ) : (
              <MenuItem icon={<Briefcase />} onSelect={() => toggleProject(true)}>
                {folder.parentId ? "Move to Home as a project" : "Make it a project"}
              </MenuItem>
            )}
            {folder.subfolderCount > 0 && (
              <MenuItem icon={<LayoutGrid />} onSelect={askToProjects}>Turn subfolders into projects</MenuItem>
            )}
            {(folder.bookmarkCount > 0 || folder.subfolderCount > 0) && (
              <MenuItem icon={<FolderOutput />} onSelect={askUnpack}>{unpackLabel}</MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={askDelete}>Move to Trash</MenuItem>
    </Menu>
  );

  const extras = (
    <>
        <RenameFolderDialog open={renameOpen} onOpenChange={setRenameOpen} id={folder.id} name={folder.name} />
        <IconDialog
          open={iconOpen}
          onOpenChange={setIconOpen}
          folderId={folder.id}
          folderName={folder.name}
          hasIcon={!!iconUrl}
          onPreview={setIconUrl}
        />
        <Dialog
          open={!!confirm}
          onOpenChange={(o) => !o && !running && setConfirm(null)}
          title={confirm?.title ?? ""}
          description={confirm?.text}
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={running}>Cancel</Button>
            <Button
              variant="primary"
              disabled={running}
              onClick={async () => {
                if (!confirm) return;
                setRunning(true);
                const err = await confirm.run();
                setRunning(false);
                setConfirm(null);
                if (err) toast.error(err);
              }}
            >
              {running ? "Working…" : confirm?.cta}
            </Button>
          </div>
        </Dialog>
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
    </>
  );

  const metaBadge = folder.launchCount > 0 && (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent"
      title={`${folder.launchCount} launch links`}
    >
      <Rocket className="h-3.5 w-3.5" aria-hidden />
      {folder.launchCount}
    </span>
  );

  if (variant === "row") {
    return (
      <li className="group relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-elevated/50 focus-within:bg-elevated/50 sm:gap-4 sm:px-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-elevated text-2xl" aria-hidden>
          {iconUrl || cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(iconUrl ?? cover)!} alt="" className="h-full w-full object-cover" />
          ) : (
            (folder.icon ?? <FolderIcon className="h-5 w-5 text-accent" />)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words font-semibold leading-snug">
            <Link href={`/f/${folder.id}`} dir="auto" className="stretched-link focus-visible:outline-none">
              {folder.name}
            </Link>
          </p>
          <p className="truncate text-xs text-muted sm:text-sm">{parts.join(" · ")}</p>
        </div>
        {metaBadge}
        <div className="relative z-10">{menu}</div>
        {extras}
      </li>
    );
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
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className={cn("h-full w-full object-cover transition-opacity", busy && "opacity-60")} />
            {(iconUrl || folder.icon) && (
              <div className="absolute bottom-2.5 left-2.5 grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-elevated text-2xl shadow-lg shadow-black/40 ring-2 ring-surface sm:h-12 sm:w-12" aria-hidden>
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  folder.icon
                )}
              </div>
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white/6 text-3xl ring-1 ring-white/10 sm:h-16 sm:w-16 sm:text-4xl" aria-hidden>
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (folder.icon ?? <FolderIcon className="h-7 w-7 text-accent sm:h-8 sm:w-8" />)
              )}
            </div>
          </div>
        )}
        <div className="absolute right-2 top-2 z-10 rounded-lg bg-black/45 backdrop-blur">
          {menu}
        </div>
        {extras}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-5">
        <h3 className="line-clamp-2 break-words text-base font-semibold leading-snug sm:text-lg">
          <Link href={`/f/${folder.id}`} dir="auto" className="stretched-link focus-visible:outline-none">
            {folder.name}
          </Link>
        </h3>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted sm:gap-3 sm:text-sm">
          <span className="truncate">{parts.join(" · ")}</span>
          {metaBadge}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function BookmarkCard({
  bookmark,
  onToggleLaunch,
  variant = "card",
}: {
  bookmark: BookmarkView;
  onToggleLaunch?: (id: string, next: boolean) => void;
  variant?: "card" | "row";
}) {
  const hue = hueFor(bookmark.domain);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();
  const letter = (bookmark.title || bookmark.domain).trim().charAt(0).toUpperCase();

  const menu = (
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
              <MenuItem icon={<Pencil />} onSelect={() => setEditOpen(true)}>Edit</MenuItem>
              <MenuItem
                icon={<ArrowRightLeft />}
                onSelect={() => router.push(bookmark.folderId ? `/organize?focus=${bookmark.folderId}` : "/organize")}
              >
                Move / reorder
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 />}
                danger
                onSelect={async () => {
                  const res = await trashBookmark(bookmark.id);
                  if (!res.ok) return toast.error("Couldn't delete the link.");
                  undoToast(`“${bookmark.title}” moved to Trash`, res.batch);
                }}
              >
                Move to Trash
              </MenuItem>
    </Menu>
  );

  const launch = (
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
  );

  if (variant === "row") {
    return (
      <li
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-elevated/50 focus-within:bg-elevated/50 sm:gap-4 sm:px-4",
          bookmark.launchOnStart && "shadow-[inset_3px_0_0_var(--color-accent)]",
        )}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevated font-heading text-lg font-semibold text-white/90" aria-hidden>
          <Favicon src={bookmark.faviconUrl} letter={letter} small />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words font-semibold leading-snug">
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer" dir="auto" className="stretched-link focus-visible:outline-none">
              {bookmark.title}
            </a>
          </p>
          <p className="truncate text-xs text-muted sm:text-sm">
            {bookmark.domain}
            {bookmark.description && <span className="hidden md:inline"> · {bookmark.description}</span>}
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-1">
          {launch}
          {menu}
        </div>
        <EditBookmarkDialog open={editOpen} onOpenChange={setEditOpen} bookmark={bookmark} />
      </li>
    );
  }

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
          {launch}
          <div className="rounded-lg bg-black/45 backdrop-blur">
            {menu}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 break-words font-semibold leading-snug">
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
      <EditBookmarkDialog open={editOpen} onOpenChange={setEditOpen} bookmark={bookmark} />
    </article>
  );
}
