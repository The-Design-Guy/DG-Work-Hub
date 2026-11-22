"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Folder as FolderIcon, FolderPlus, FolderTree, Plus, Rocket } from "lucide-react";
import { setLaunch } from "@/app/actions/bookmarks";
import type { BookmarkView, FolderView } from "@/lib/types";
import { BookmarkCard, FolderCard } from "./cards";
import { Button, buttonClass } from "./ui/button";
import { EmptyState } from "./empty-state";

const later = (what: string) => toast(`${what} is connected in an upcoming step.`);

export function FolderGrid({ folders }: { folders: FolderView[] }) {
  return (
    <div className="card-grid card-grid-folders">
      {folders.map((f) => (
        <FolderCard key={f.id} folder={f} onAction={(a) => later(a === "delete" ? "Trash" : a[0].toUpperCase() + a.slice(1))} />
      ))}
    </div>
  );
}

function useLaunchToggle(initial: BookmarkView[]) {
  const [bookmarks, setBookmarks] = useState(initial);
  // Server data changed (refresh after an action): take the new list.
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setBookmarks(initial);
  }
  async function toggle(id: string, next: boolean) {
    setBookmarks((list) => list.map((b) => (b.id === id ? { ...b, launchOnStart: next } : b)));
    const res = await setLaunch(id, next);
    if (!res.ok) {
      setBookmarks((list) => list.map((b) => (b.id === id ? { ...b, launchOnStart: !next } : b)));
      toast.error("Couldn't save. Try again.");
      return;
    }
    toast(next ? "Added to Launch Workspace" : "Removed from Launch Workspace");
  }
  return { bookmarks, toggle };
}

function Cards({ bookmarks, toggle }: { bookmarks: BookmarkView[]; toggle: (id: string, next: boolean) => void }) {
  return (
    <div className="card-grid">
      {bookmarks.map((b) => (
        <BookmarkCard
          key={b.id}
          bookmark={b}
          onToggleLaunch={toggle}
          onAction={(a) => later(a === "delete" ? "Trash" : a[0].toUpperCase() + a.slice(1))}
        />
      ))}
    </div>
  );
}

export function BookmarkGrid({ bookmarks: initial }: { bookmarks: BookmarkView[] }) {
  const { bookmarks, toggle } = useLaunchToggle(initial);
  return <Cards bookmarks={bookmarks} toggle={toggle} />;
}

export function FolderContents({
  folder,
  subfolders,
  bookmarks: initial,
}: {
  folder: FolderView;
  subfolders: FolderView[];
  bookmarks: BookmarkView[];
}) {
  const { bookmarks, toggle } = useLaunchToggle(initial);
  const launchCount = bookmarks.filter((b) => b.launchOnStart).length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface text-4xl" aria-hidden>
            {folder.iconUrl || folder.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(folder.iconUrl ?? folder.coverUrl)!} alt="" className="h-full w-full object-cover" />
            ) : (
              (folder.icon ?? <FolderIcon className="h-8 w-8 text-accent" />)
            )}
          </div>
          <div className="min-w-0">
            <h1 dir="auto" className="line-clamp-2 break-words text-left text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{folder.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {bookmarks.length} {bookmarks.length === 1 ? "link" : "links"}
              {subfolders.length > 0 && ` · ${subfolders.length} ${subfolders.length === 1 ? "folder" : "folders"}`}
              {launchCount > 0 && ` · ${launchCount} in Launch Workspace`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link href={`/organize?focus=${folder.id}`} className={buttonClass("secondary", "md", "h-12")}>
          <FolderTree className="h-4.5 w-4.5" /> Organize
        </Link>
        {launchCount > 0 && (
          <Button variant="primary" className="h-12 px-5 text-base" onClick={() => later("Launch Workspace")}>
            <Rocket className="h-5 w-5" />
            Launch Workspace
            <span className="rounded-md bg-black/15 px-1.5 text-sm">{launchCount}</span>
          </Button>
        )}
        </div>
      </div>

      {subfolders.length > 0 && (
        <section className="mt-10" aria-labelledby="sub-h">
          <h2 id="sub-h" className="section-title">Folders</h2>
          <FolderGrid folders={subfolders} />
        </section>
      )}

      <section className="mt-10" aria-labelledby="links-h">
        <h2 id="links-h" className="section-title">Links</h2>
        {bookmarks.length ? (
          <Cards bookmarks={bookmarks} toggle={toggle} />
        ) : (
          <EmptyState
            title="No links here yet"
            text="Add your first link to this folder. Mark the ones you work with daily to launch them together."
            action={
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => later("Add bookmark")}><Plus className="h-4.5 w-4.5" />Add Bookmark</Button>
                <Button onClick={() => later("New folder")}><FolderPlus className="h-4.5 w-4.5" />Subfolder</Button>
              </div>
            }
          />
        )}
      </section>
    </>
  );
}
