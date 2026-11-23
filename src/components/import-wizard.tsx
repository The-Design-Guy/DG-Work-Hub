"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, FileUp, Folder, FolderOpen, Search, Upload } from "lucide-react";
import { importBookmarks, undoImport } from "@/app/actions/import";
import { buildPayload, leafIds, parseChromeBookmarks, walk, type TreeNode } from "@/lib/chrome-bookmarks";
import { urlKey } from "@/lib/url";
import { folderOptions } from "@/lib/folder-options";
import { Button, cn } from "./ui/button";
import { inputClass } from "./ui/dialog";

type FolderOption = { id: string; parentId: string | null; name: string };

const MAX_FILE = 25 * 1024 * 1024;
const MAX_BODY = 3_800_000;

/* ------------------------------------------------------------------ */

const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ------------------------------------------------------------------ */

export function ImportWizard({ folders, existingUrls }: { folders: FolderOption[]; existingUrls: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dest, setDest] = useState<string>("new");
  const [newName, setNewName] = useState(`Chrome import ${today()}`);
  const [unwrapTop, setUnwrapTop] = useState(true);
  const [skipDupes, setSkipDupes] = useState(true);
  const [pending, start] = useTransition();

  const options = useMemo(() => folderOptions(folders), [folders]);
  const existing = useMemo(() => new Set(existingUrls.map(urlKey)), [existingUrls]);

  // Index: links, duplicates, invalid, parents.
  const index = useMemo(() => {
    const links: Extract<TreeNode, { kind: "link" }>[] = [];
    const dupes = new Set<string>();
    const invalid = new Set<string>();
    const leaves = new Map<string, string[]>();
    const linkCount = new Map<string, number>();
    if (tree) {
      walk(tree, (n, parents) => {
        if (n.kind === "link") parents.forEach((p) => linkCount.set(p.id, (linkCount.get(p.id) ?? 0) + 1));
        if (n.kind === "folder") leaves.set(n.id, leafIds(n));
        else {
          links.push(n);
          if (!/^https?:\/\//i.test(n.url)) invalid.add(n.id);
          else if (existing.has(urlKey(n.url))) dupes.add(n.id);
        }
      });
    }
    return { links, dupes, invalid, leaves, linkCount };
  }, [tree, existing]);

  // Search: which nodes to show (matches + their ancestors).
  const visible = useMemo(() => {
    if (!tree || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    const show = new Set<string>();
    walk(tree, (n, parents) => {
      const hit = n.title.toLowerCase().includes(q) || (n.kind === "link" && n.url.toLowerCase().includes(q));
      if (hit) {
        show.add(n.id);
        parents.forEach((p) => show.add(p.id));
        if (n.kind === "folder") walk(n.children, (c) => show.add(c.id));
      }
    });
    return show;
  }, [tree, query]);

  async function readFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE) return setError("That file is larger than 25 MB.");
    try {
      const nodes = parseChromeBookmarks(await file.text());
      let links = 0;
      walk(nodes, (n) => n.kind === "link" && links++);
      if (!links) return setError("No bookmarks found in this file. Is it the file Chrome exported?");
      const all = new Set<string>();
      walk(nodes, (n) => (n.kind === "link" || n.children.length === 0) && all.add(n.id));
      setTree(nodes);
      setSelected(all);
      setExpanded(new Set(nodes.filter((n) => n.kind === "folder").map((n) => n.id)));
      setFileName(file.name);
      setUnwrapTop(nodes.every((n) => n.kind === "folder"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this file.");
    }
  }

  function toggle(n: TreeNode, on: boolean) {
    const ids = n.kind === "link" ? [n.id] : (index.leaves.get(n.id) ?? []);
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  const selLinks = index.links.filter((l) => selected.has(l.id));
  const selDupes = selLinks.filter((l) => index.dupes.has(l.id)).length;
  const selInvalid = selLinks.filter((l) => index.invalid.has(l.id)).length;
  const toImport = selLinks.length - selInvalid - (skipDupes ? selDupes : 0);

  function submit() {
    if (!tree) return;
    const skip = new Set<string>([...index.invalid, ...(skipDupes ? index.dupes : [])]);
    const destination =
      dest === "root"
        ? ({ type: "root" } as const)
        : dest === "new"
          ? ({ type: "new", name: newName.trim() || `Chrome import ${today()}`, parentId: null } as const)
          : ({ type: "folder", id: dest } as const);

    let nodes = buildPayload(tree, selected, { unwrapTop, skip, includeIcons: true });
    if (JSON.stringify(nodes).length > MAX_BODY) nodes = buildPayload(tree, selected, { unwrapTop, skip, includeIcons: false });
    if (JSON.stringify(nodes).length > MAX_BODY) {
      return setError("That's too much for one import. Select fewer folders and import in two parts.");
    }

    start(async () => {
      const res = await importBookmarks({ destination, nodes });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Imported ${res.bookmarks} links${res.folders ? ` and ${res.folders} folders` : ""}.`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            await undoImport(res.importId);
            toast("Import undone. Everything moved to Trash.");
            router.refresh();
          },
        },
      });
      router.push(res.destinationId ? `/f/${res.destinationId}` : "/");
      router.refresh();
    });
  }

  /* ---------- step 1: choose file ---------- */
  if (!tree) {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) readFile(f);
    };
    return (
      <div className="mx-auto max-w-2xl">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center rounded-[var(--radius-card)] border-2 border-dashed px-6 py-16 text-center transition-colors focus-within:border-accent",
            drag ? "border-accent bg-accent/5" : "border-line hover:border-muted",
          )}
        >
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/12 text-accent">
            <FileUp className="h-8 w-8" />
          </span>
          <span className="mt-5 font-heading text-xl font-semibold">Drop your Chrome bookmarks file</span>
          <span className="mt-1 text-sm text-muted">or click to choose it (bookmarks_*.html)</span>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,text/html"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-sm text-muted">
          <p className="font-semibold text-text">How to get the file from Chrome</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>Open Chrome&apos;s Bookmark manager: <kbd className="rounded border border-line px-1.5">Ctrl</kbd> + <kbd className="rounded border border-line px-1.5">Shift</kbd> + <kbd className="rounded border border-line px-1.5">O</kbd></li>
            <li>Click the ⋮ menu at the top right → <span className="text-text">Export bookmarks</span></li>
            <li>Save the file, then drop it here.</li>
          </ol>
          <p className="mt-4">The file is read on this device. Only the bookmarks you pick are saved.</p>
        </div>
      </div>
    );
  }

  /* ---------- step 2: choose items + destination ---------- */
  const renderNode = (n: TreeNode, depth: number): React.ReactNode => {
    if (visible && !visible.has(n.id)) return null;
    const pad = { paddingLeft: `${depth * 22 + 8}px` };

    if (n.kind === "link") {
      const on = selected.has(n.id);
      const dupe = index.dupes.has(n.id);
      const bad = index.invalid.has(n.id);
      let domain = "";
      try {
        domain = new URL(n.url).hostname.replace(/^www\./, "");
      } catch {}
      return (
        <li key={n.id}>
          <label style={pad} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg pr-3 hover:bg-elevated/60">
            <span className="w-5 shrink-0" />
            <input type="checkbox" checked={on} onChange={(e) => toggle(n, e.target.checked)} className="h-4.5 w-4.5 shrink-0 accent-[#ffb600]" />
            {n.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.icon} alt="" className="h-4 w-4 shrink-0" />
            ) : (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-elevated text-[9px] font-bold text-muted">
                {(n.title || domain || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className={cn("min-w-0 flex-1 truncate text-sm", !on && "text-muted")}>{n.title || n.url}</span>
            <span className="hidden max-w-48 shrink-0 truncate text-xs text-muted sm:block">{domain}</span>
            {dupe && <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted">Already saved</span>}
            {bad && <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] text-danger">Not a web link</span>}
          </label>
        </li>
      );
    }

    const leaves = index.leaves.get(n.id) ?? [];
    const count = leaves.filter((id) => selected.has(id)).length;
    const all = count === leaves.length && leaves.length > 0;
    const some = count > 0 && !all;
    const open = !!visible || expanded.has(n.id);
    const links = index.linkCount.get(n.id) ?? 0;
    return (
      <li key={n.id}>
        <div style={pad} className="flex min-h-11 items-center gap-3 rounded-lg pr-3 hover:bg-elevated/60">
          <button
            type="button"
            aria-label={open ? `Collapse ${n.title}` : `Expand ${n.title}`}
            aria-expanded={open}
            onClick={() =>
              setExpanded((s) => {
                const next = new Set(s);
                if (next.has(n.id)) next.delete(n.id);
                else next.add(n.id);
                return next;
              })
            }
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:text-text"
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </button>
          <input
            type="checkbox"
            aria-label={`Select folder ${n.title}`}
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = some;
            }}
            onChange={(e) => toggle(n, e.target.checked)}
            className="h-4.5 w-4.5 shrink-0 accent-[#ffb600]"
          />
          {open ? <FolderOpen className="h-4 w-4 shrink-0 text-accent" /> : <Folder className="h-4 w-4 shrink-0 text-accent" />}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{n.title}</span>
          <span className="shrink-0 text-xs text-muted">
            {count === leaves.length ? links : `${Math.min(count, links)} / ${links}`}
          </span>
        </div>
        {open && n.children.length > 0 && <ul>{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  const allLeaves = tree.flatMap(leafIds);
  const topAreFolders = tree.every((n) => n.kind === "folder");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* Tree */}
      <section aria-label="Bookmarks in the file" className="rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this file"
              aria-label="Filter bookmarks in this file"
              className={cn(inputClass, "pl-9")}
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(allLeaves))}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Select none</Button>
        </div>
        <ul className="max-h-[65vh] overflow-auto p-2">{tree.map((n) => renderNode(n, 0))}</ul>
      </section>

      {/* Options */}
      <aside className="space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:sticky lg:top-40">
        <div>
          <p className="truncate text-xs text-muted">{fileName}</p>
          <p className="mt-1 font-heading text-2xl font-semibold">
            {toImport} <span className="text-base font-normal text-muted">of {index.links.length} links</span>
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Import into</span>
          <select value={dest} onChange={(e) => setDest(e.target.value)} className={inputClass}>
            <option value="new">A new folder…</option>
            <option value="root">Top level (Home)</option>
            {options.length > 0 && (
              <optgroup label="Existing folder">
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {dest === "new" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">New folder name</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
          </label>
        )}

        <div className="space-y-3 text-sm">
          {topAreFolders && (
            <label className="flex cursor-pointer gap-3">
              <input type="checkbox" checked={unwrapTop} onChange={(e) => setUnwrapTop(e.target.checked)} className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[#ffb600]" />
              <span>
                Don&apos;t create folders for {tree.map((n) => `“${n.title}”`).join(", ")}
                <span className="block text-xs text-muted">Their contents go straight into the destination.</span>
              </span>
            </label>
          )}
          {selDupes > 0 && (
            <label className="flex cursor-pointer gap-3">
              <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[#ffb600]" />
              <span>
                Skip {selDupes} {selDupes === 1 ? "link" : "links"} you already have
                <span className="block text-xs text-muted">Uncheck to import them again as duplicates.</span>
              </span>
            </label>
          )}
          {selInvalid > 0 && (
            <p className="text-xs text-muted">
              {selInvalid} selected {selInvalid === 1 ? "item isn't a web link" : "items aren't web links"} (like chrome:// or javascript:) and will be skipped.
            </p>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button variant="primary" className="h-12 justify-center text-base" disabled={pending || toImport <= 0} onClick={submit}>
            <Upload className="h-5 w-5" />
            {pending ? "Importing…" : `Import ${toImport} ${toImport === 1 ? "link" : "links"}`}
          </Button>
          <Button
            variant="ghost"
            className="justify-center"
            disabled={pending}
            onClick={() => {
              setTree(null);
              setError(null);
              setQuery("");
            }}
          >
            Choose a different file
          </Button>
        </div>
        <p className="text-xs text-muted">Nothing in your collection is replaced or removed. You can undo right after importing.</p>
      </aside>
    </div>
  );
}
