"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";
import type { TopItemView } from "@/lib/data";
import { buttonClass } from "./ui/button";

const item = "flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-surface";

/** A folder pinned to the top bar: a chip that opens a menu of its links. */
export function PinnedFolderMenu({ folder }: { folder: TopItemView }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <button type="button" className={buttonClass("ghost", "sm", "border border-line/70 bg-surface/60 text-text/90 data-[state=open]:border-accent")}>
          {folder.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={folder.iconUrl} alt="" className="h-5 w-5 rounded-md object-cover" />
          ) : (
            <Folder className="h-4 w-4 text-accent" />
          )}
          <span dir="auto">{folder.title}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[70vh] w-72 overflow-auto rounded-xl border border-line bg-elevated p-1.5 shadow-2xl shadow-black/50"
        >
          {folder.links.length === 0 && folder.subfolders.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">This folder is empty.</p>
          )}
          {folder.links.map((l) => (
            <DM.Item key={l.id} asChild>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className={item}
                onClick={() => {
                  try {
                    navigator.sendBeacon(`/api/opened/${l.id}`);
                  } catch {}
                }}
              >
                {l.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.faviconUrl} alt="" className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-surface text-[9px] font-bold text-muted">
                    {(l.title || l.domain).charAt(0).toUpperCase()}
                  </span>
                )}
                <span dir="auto" className="min-w-0 flex-1 truncate text-left">{l.title}</span>
              </a>
            </DM.Item>
          ))}
          {folder.subfolders.length > 0 && folder.links.length > 0 && <DM.Separator className="my-1 h-px bg-line" />}
          {folder.subfolders.map((s) => (
            <DM.Item key={s.id} asChild>
              <Link href={`/f/${s.id}`} className={item}>
                <Folder className="h-4 w-4 shrink-0 text-accent" />
                <span dir="auto" className="min-w-0 flex-1 truncate text-left">{s.name}</span>
              </Link>
            </DM.Item>
          ))}
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item asChild>
            <Link href={`/f/${folder.folderId}`} className={`${item} text-muted`}>
              <FolderOpen className="h-4 w-4 shrink-0" />
              Open folder
            </Link>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
