"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FolderLite } from "@/lib/folder-options";
import { useEffect, useRef, useState } from "react";
import { FolderPlus, Plus, Search } from "lucide-react";
import type { BookmarkView } from "@/lib/types";
import { Button, buttonClass } from "./ui/button";
import { NavMenu } from "./nav-menu";
import { AddBookmarkDialog, NewFolderDialog } from "./dialogs";

export function TopBar({
  user,
  pinned,
  folders,
}: {
  user: { name: string; email: string; image?: string | null };
  pinned: BookmarkView[];
  folders: FolderLite[];
}) {
  const pathname = usePathname();
  const currentFolder = pathname.match(/^\/f\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const searchRef = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [addBookmark, setAddBookmark] = useState(false);

  // "/" or Ctrl/Cmd+K focuses search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    // Empty states and other screens can open these dialogs.
    const openAdd = () => setAddBookmark(true);
    const openFolder = () => setNewFolder(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dg:add-bookmark", openAdd);
    window.addEventListener("dg:new-folder", openFolder);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dg:add-bookmark", openAdd);
      window.removeEventListener("dg:new-folder", openFolder);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-xl sm:gap-3 sm:pr-1"
          aria-label="Design Guy — The Work Hub, home"
        >
          <Image src="/brand/dg-head.svg" alt="" width={52} height={52} priority className="h-11 w-11 sm:h-[52px] sm:w-[52px]" />
          <span className="flex flex-col items-start gap-1 sm:gap-1.5">
            <Image
              src="/brand/dg-wordmark.svg"
              alt=""
              width={164}
              height={20}
              priority
              className="h-4 w-auto sm:h-6 lg:h-7"
            />
            <span className="font-heading text-[8px] font-medium uppercase leading-none tracking-[0.3em] text-text sm:text-[11px] lg:text-xs">
              The Work Hub
            </span>
          </span>
        </Link>

        <div className="relative order-last w-full sm:order-none sm:max-w-xl sm:flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search folders and links"
            aria-label="Search folders and links"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-14 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted sm:block">
            Ctrl K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button variant="secondary" size="md" onClick={() => setNewFolder(true)} aria-label="New folder">
            <FolderPlus className="h-4.5 w-4.5" />
            <span className="hidden lg:inline">New Folder</span>
          </Button>
          <Button variant="primary" size="md" onClick={() => setAddBookmark(true)} aria-label="Add bookmark">
            <Plus className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Add Bookmark</span>
          </Button>
          <NavMenu email={user.email} />
        </div>
      </div>

      {pinned.length > 0 && (
        <nav aria-label="Pinned links" className="mx-auto max-w-[1440px] px-4 pb-3 sm:px-8">
          <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {pinned.map((p) => (
              <li key={p.id} className="shrink-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("ghost", "sm", "border border-line/70 bg-surface/60 text-text/90")}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-elevated text-[11px] font-semibold">
                    {p.title.charAt(0)}
                  </span>
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <NewFolderDialog open={newFolder} onOpenChange={setNewFolder} folders={folders} defaultParentId={currentFolder} />
      <AddBookmarkDialog open={addBookmark} onOpenChange={setAddBookmark} folders={folders} defaultFolderId={currentFolder} />
    </header>
  );
}
