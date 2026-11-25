"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Folder, FolderOpen, Search } from "lucide-react";
import { searchAll, type SearchResult } from "@/app/actions/search";
import { cn } from "./ui/button";

type Row =
  | { kind: "folder"; id: string; label: string; sub: string; href: string }
  | { kind: "link"; id: string; label: string; sub: string; url: string; folderHref: string; icon: string | null; domain: string };

function rows(r: SearchResult): Row[] {
  return [
    ...r.folders.map((f): Row => ({ kind: "folder", id: f.id, label: f.name, sub: f.path, href: `/f/${f.id}` })),
    ...r.links.map(
      (l): Row => ({
        kind: "link",
        id: l.id,
        label: l.title,
        sub: `${l.domain} · ${l.path}`,
        url: l.url,
        folderHref: l.folderId ? `/f/${l.folderId}` : "/",
        icon: l.faviconUrl,
        domain: l.domain,
      }),
    ),
  ];
}

/** Top-bar search with instant suggestions. Enter opens the highlighted result. */
export const SearchBox = forwardRef<{ focus: () => void }>(function SearchBox(_, ref) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchAll(term);
      if (n !== seq.current) return;
      setLoading(false);
      setItems(rows(res));
      setActive(0);
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  function choose(row: Row | undefined, toFolder = false) {
    if (!row) return;
    setOpen(false);
    if (row.kind === "folder") return router.push(row.href);
    if (toFolder) return router.push(row.folderHref);
    try {
      navigator.sendBeacon(`/api/opened/${row.id}`);
    } catch {}
    window.open(row.url, "_blank", "noopener,noreferrer");
  }

  const show = open && q.trim().length > 0;

  return (
    <div className="relative order-last w-full sm:order-none sm:max-w-xl sm:flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={show}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={show && items[active] ? `sr-${items[active].kind}-${items[active].id}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) setItems([]);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(items[active], e.altKey);
          } else if (e.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
        }}
        placeholder="Search folders and links"
        aria-label="Search folders and links"
        className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-14 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {!q && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted sm:block">
          Ctrl K
        </kbd>
      )}

      {show && (
        <div
          id="search-results"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-auto rounded-xl border border-line bg-elevated p-1.5 shadow-2xl shadow-black/60"
        >
          {!items.length ? (
            <p className="px-3 py-3 text-sm text-muted">{loading ? "Searching…" : `Nothing found for “${q.trim()}”`}</p>
          ) : (
            items.map((r, i) => (
              <div
                key={`${r.kind}-${r.id}`}
                id={`sr-${r.kind}-${r.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2", i === active && "bg-surface")}
              >
                {r.kind === "folder" ? (
                  <Folder className="h-5 w-5 shrink-0 text-accent" />
                ) : r.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.icon} alt="" className="h-5 w-5 shrink-0 rounded" />
                ) : (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface text-[10px] font-bold text-muted">
                    {(r.label || r.domain).charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-left text-sm font-semibold">{r.label}</p>
                  <p className="truncate text-xs text-muted">{r.sub}</p>
                </div>
                {r.kind === "link" && (
                  <button
                    type="button"
                    tabIndex={-1}
                    title="Go to its folder"
                    aria-label={`Go to the folder of ${r.label}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      choose(r, true);
                    }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-bg hover:text-text"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </button>
                )}
                {i === active && <CornerDownLeft className="hidden h-4 w-4 shrink-0 text-muted sm:block" aria-hidden />}
              </div>
            ))
          )}
          {items.length > 0 && (
            <p className="border-t border-line px-3 pb-1 pt-2 text-[11px] text-muted">
              ↑↓ to move · Enter to open · Alt+Enter to go to the folder
            </p>
          )}
        </div>
      )}
    </div>
  );
});
