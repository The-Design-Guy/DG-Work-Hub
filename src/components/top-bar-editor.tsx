"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, Folder, Link2, Plus, Trash2 } from "lucide-react";
import {
  addTopFolder,
  addTopLink,
  moveTopItem,
  removeTopItem,
  removeTopItemIcon,
  setTopItemIcon,
  updateTopItem,
} from "@/app/actions/top-bar";
import type { TopItemView } from "@/lib/data";
import { folderOptions, type FolderLite } from "@/lib/folder-options";
import { Dialog, inputClass } from "./ui/dialog";
import { Button, cn } from "./ui/button";
import { IconDialog } from "./icon-dialog";

const NEW = "__new__";

export function TopBarEditor({
  open,
  onOpenChange,
  items,
  folders,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: TopItemView[];
  folders: FolderLite[];
}) {
  const [iconFor, setIconFor] = useState<TopItemView | null>(null);
  const [adding, setAdding] = useState<null | "link" | "folder">(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [folderPick, setFolderPick] = useState(NEW);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => folderOptions(folders), [folders]);
  const pinnedFolderIds = new Set(items.flatMap((i) => (i.folderId ? [i.folderId] : [])));

  async function run<T extends { ok: boolean; error?: string }>(p: Promise<T>, success?: string) {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Couldn't save.");
    else if (success) toast.success(success);
    return res.ok;
  }

  async function submitLink(e: FormEvent) {
    e.preventDefault();
    if (await run(addTopLink(linkUrl, linkTitle), "Link added")) {
      setLinkUrl("");
      setLinkTitle("");
      setAdding(null);
    }
  }

  async function submitFolder(e: FormEvent) {
    e.preventDefault();
    const input = folderPick === NEW ? { newName } : { folderId: folderPick };
    if (await run(addTopFolder(input), "Dropdown added")) {
      setNewName("");
      setFolderPick(NEW);
      setAdding(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} title="Edit top bar" description="Links open in a new tab. Dropdowns show a folder's links.">
        <ul className="-mx-2 max-h-[50vh] space-y-1 overflow-auto px-2">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg p-2">
              <button
                type="button"
                onClick={() => setIconFor(it)}
                aria-label={`Change icon for ${it.title}`}
                title="Change icon"
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-elevated hover:ring-2 hover:ring-accent"
              >
                {it.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.iconUrl} alt="" className="h-6 w-6 object-contain" />
                ) : it.kind === "folder" ? (
                  <Folder className="h-5 w-5 text-accent" />
                ) : (
                  <span className="text-sm font-bold">{it.title.charAt(0).toUpperCase()}</span>
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  dir="auto"
                  defaultValue={it.customTitle ?? ""}
                  placeholder={it.kind === "folder" ? it.title : "Name"}
                  aria-label="Name"
                  onBlur={(e) => e.target.value.trim() !== (it.customTitle ?? "") && run(updateTopItem(it.id, { title: e.target.value }))}
                  className={cn(inputClass, "h-9 py-1.5")}
                />
                {it.kind === "link" ? (
                  <input
                    defaultValue={it.url ?? ""}
                    aria-label="URL"
                    inputMode="url"
                    onBlur={(e) => e.target.value.trim() !== (it.url ?? "") && run(updateTopItem(it.id, { url: e.target.value }))}
                    className={cn(inputClass, "h-8 py-1 text-xs text-muted")}
                  />
                ) : (
                  <p className="flex items-center gap-1 px-1 text-xs text-muted">
                    <ChevronDown className="h-3 w-3" /> Dropdown · {it.links.length} links
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col">
                <button type="button" disabled={busy || i === 0} onClick={() => run(moveTopItem(it.id, -1))} aria-label={`Move ${it.title} left`} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-text disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" disabled={busy || i === items.length - 1} onClick={() => run(moveTopItem(it.id, 1))} aria-label={`Move ${it.title} right`} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-text disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(removeTopItem(it.id), "Removed from the top bar")}
                aria-label={`Remove ${it.title}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/15 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {!items.length && <li className="py-6 text-center text-sm text-muted">The top bar is empty.</li>}
        </ul>

        <div className="mt-5 border-t border-line pt-5">
          {adding === "link" ? (
            <form onSubmit={submitLink} className="space-y-2">
              <input autoFocus required inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" aria-label="Link URL" className={inputClass} />
              <input dir="auto" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Name (optional)" aria-label="Link name" className={inputClass} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Add link"}</Button>
              </div>
            </form>
          ) : adding === "folder" ? (
            <form onSubmit={submitFolder} className="space-y-2">
              <select value={folderPick} onChange={(e) => setFolderPick(e.target.value)} aria-label="Folder" className={inputClass}>
                <option value={NEW}>New folder…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id} disabled={pinnedFolderIds.has(o.id)}>{o.label}</option>
                ))}
              </select>
              {folderPick === NEW && (
                <input autoFocus required dir="auto" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Dropdown name, e.g. AI TOOLS" aria-label="New folder name" className={inputClass} />
              )}
              <p className="text-xs text-muted">A new folder is created in Library. Add links to it like any folder.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Add dropdown"}</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAdding("link")}><Link2 className="h-4 w-4" /> Add link</Button>
              <Button onClick={() => setAdding("folder")}><Plus className="h-4 w-4" /> Add dropdown</Button>
            </div>
          )}
        </div>
      </Dialog>

      {iconFor && (
        <IconDialog
          open
          onOpenChange={(o) => !o && setIconFor(null)}
          name={iconFor.title}
          hasIcon={iconFor.hasCustomIcon}
          initialSite={iconFor.url ? new URL(iconFor.url).hostname : ""}
          loadSuggestions={async () => iconFor.links.map((l) => l.domain).filter((d, i, a) => a.indexOf(d) === i).slice(0, 10)}
          save={(form) => setTopItemIcon(iconFor.id, form)}
          remove={() => removeTopItemIcon(iconFor.id)}
        />
      )}
    </>
  );
}
