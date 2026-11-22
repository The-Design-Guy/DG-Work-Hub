"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Home,
  RotateCcw,
  Save,
} from "lucide-react";
import { applyOrganize } from "@/app/actions/organize";
import { Button, cn } from "./ui/button";
import { Dialog } from "./ui/dialog";

/* ------------------------------------------------------------------ */
/* Model                                                                */
/* ------------------------------------------------------------------ */

type FolderRow = { id: string; parentId: string | null; name: string; isProject: boolean };
type LinkRow = { id: string; folderId: string | null; title: string; domain: string; faviconUrl: string | null };

const ROOT = "root";
type Key = string; // folder id or ROOT

type Tree = { kidsF: Record<Key, string[]>; kidsB: Record<Key, string[]> };
type Item = { type: "f" | "b"; id: string };
type Zone = "before" | "after" | "into";
type Hint = { type: "f" | "b" | "root"; id: string; zone: Zone } | null;

function build(folders: FolderRow[], links: LinkRow[]): Tree {
  const kidsF: Record<Key, string[]> = { [ROOT]: [] };
  const kidsB: Record<Key, string[]> = { [ROOT]: [] };
  for (const f of folders) {
    kidsF[f.id] ??= [];
    kidsB[f.id] ??= [];
  }
  for (const f of folders) (kidsF[f.parentId ?? ROOT] ??= []).push(f.id);
  for (const b of links) (kidsB[b.folderId ?? ROOT] ??= []).push(b.id);
  return { kidsF, kidsB };
}

function parents(t: Tree) {
  const pf: Record<string, Key> = {};
  const pb: Record<string, Key> = {};
  for (const [k, ids] of Object.entries(t.kidsF)) for (const id of ids) pf[id] = k;
  for (const [k, ids] of Object.entries(t.kidsB)) for (const id of ids) pb[id] = k;
  return { pf, pb };
}

function isInside(pf: Record<string, Key>, target: Key, folderId: string) {
  let cur: Key | undefined = target;
  while (cur && cur !== ROOT) {
    if (cur === folderId) return true;
    cur = pf[cur];
  }
  return false;
}

function move(t: Tree, item: Item, to: Key, index: number): Tree {
  const map = item.type === "f" ? t.kidsF : t.kidsB;
  const next = { ...map };
  for (const k of Object.keys(next)) {
    const i = next[k].indexOf(item.id);
    if (i >= 0) {
      next[k] = next[k].filter((x) => x !== item.id);
      if (k === to && i < index) index--;
    }
  }
  const list = [...(next[to] ?? [])];
  list.splice(Math.max(0, Math.min(index, list.length)), 0, item.id);
  next[to] = list;
  return item.type === "f" ? { ...t, kidsF: next } : { ...t, kidsB: next };
}

const same = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ------------------------------------------------------------------ */

export function OrganizeView({ folders, links, focus }: { folders: FolderRow[]; links: LinkRow[]; focus?: string }) {
  const router = useRouter();
  const byF = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const byB = useMemo(() => new Map(links.map((b) => [b.id, b])), [links]);
  const original = useMemo(() => build(folders, links), [folders, links]);
  const origP = useMemo(() => parents(original), [original]);

  const [draft, setDraft] = useState(original);
  const [prevOriginal, setPrevOriginal] = useState(original);
  if (prevOriginal !== original) {
    setPrevOriginal(original);
    setDraft(original);
  }
  const draftP = useMemo(() => parents(draft), [draft]);

  // Open the path to the focused folder in both panes.
  const initialOpen = useMemo(() => {
    const s = new Set<string>();
    let cur: Key | undefined = focus && byF.has(focus) ? focus : undefined;
    while (cur && cur !== ROOT) {
      s.add(cur);
      cur = origP.pf[cur];
    }
    return s;
  }, [focus, byF, origP]);
  const [openL, setOpenL] = useState(initialOpen);
  const [openR, setOpenR] = useState(initialOpen);

  const [tab, setTab] = useState<"current" | "edit">("edit");
  const [drag, setDrag] = useState<Item | null>(null);
  const [hint, setHint] = useState<Hint>(null);
  const [moveDlg, setMoveDlg] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const hoverTimer = useRef<{ id: string; t: ReturnType<typeof setTimeout> } | null>(null);

  // What changed.
  const movedF = folders.filter((f) => origP.pf[f.id] !== draftP.pf[f.id]).length;
  const movedB = links.filter((b) => origP.pb[b.id] !== draftP.pb[b.id]).length;
  const keys = new Set([...Object.keys(draft.kidsF), ...Object.keys(draft.kidsB)]);
  const reordered = [...keys].filter(
    (k) =>
      (!same(draft.kidsF[k], original.kidsF[k]) && (draft.kidsF[k]?.length ?? 0) === (original.kidsF[k]?.length ?? 0)) ||
      (!same(draft.kidsB[k], original.kidsB[k]) && (draft.kidsB[k]?.length ?? 0) === (original.kidsB[k]?.length ?? 0)),
  ).length;
  const dirty = [...keys].some((k) => !same(draft.kidsF[k], original.kidsF[k]) || !same(draft.kidsB[k], original.kidsB[k]));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function apply(item: Item, to: Key, index: number) {
    if (item.type === "f" && (to === item.id || isInside(draftP.pf, to, item.id))) {
      toast.error("A folder can't go inside itself.");
      return;
    }
    setDraft((d) => move(d, item, to, index));
    if (to !== ROOT) setOpenR((s) => new Set(s).add(to));
  }

  async function save() {
    setSaving(true);
    const fOut: { id: string; parentId: string | null; sortOrder: number }[] = [];
    const bOut: { id: string; folderId: string | null; sortOrder: number }[] = [];
    for (const k of keys) {
      const pid = k === ROOT ? null : k;
      if (!same(draft.kidsF[k], original.kidsF[k])) draft.kidsF[k]?.forEach((id, i) => fOut.push({ id, parentId: pid, sortOrder: i + 1 }));
      if (!same(draft.kidsB[k], original.kidsB[k])) draft.kidsB[k]?.forEach((id, i) => bOut.push({ id, folderId: pid, sortOrder: i + 1 }));
    }
    const res = await applyOrganize({ folders: fOut, bookmarks: bOut });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Changes saved");
    router.refresh();
  }

  /* ---------- drag & drop: mouse, trackpad and touch (dnd-kit) ---------- */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function pointerY(e: DragMoveEvent) {
    const a = e.activatorEvent as MouseEvent | TouchEvent;
    const y0 = "touches" in a ? (a.touches[0] ?? a.changedTouches[0]).clientY : a.clientY;
    return y0 + e.delta.y;
  }

  function onStart(e: DragStartEvent) {
    setDrag(parseUid(String(e.active.id)));
  }

  function onMove(e: DragMoveEvent) {
    const d = drag;
    if (!d || !e.over) return hint && setHint(null);
    const overId = String(e.over.id);
    if (overId === ROOT) {
      if (hint?.type !== "root") setHint({ type: "root", id: ROOT, zone: "into" });
      return;
    }
    const target = parseUid(overId);
    if (!target) return;
    const r = e.over.rect;
    const y = (pointerY(e) - r.top) / r.height;
    let zone: Zone | null;
    if (target.type === "f") zone = d.type === "b" ? "into" : y < 0.28 ? "before" : y > 0.72 ? "after" : "into";
    else zone = d.type === "f" ? null : y < 0.5 ? "before" : "after";
    if (!zone || (d.type === "f" && target.type === "f" && (target.id === d.id || isInside(draftP.pf, target.id, d.id)))) {
      return hint && setHint(null);
    }
    if (hint?.id !== target.id || hint.zone !== zone || hint.type !== target.type) setHint({ type: target.type, id: target.id, zone });
    // Holding over a closed folder opens it.
    if (target.type === "f" && zone === "into" && !openR.has(target.id)) {
      if (hoverTimer.current?.id !== target.id) {
        if (hoverTimer.current) clearTimeout(hoverTimer.current.t);
        const id = target.id;
        hoverTimer.current = { id, t: setTimeout(() => setOpenR((s) => new Set(s).add(id)), 700) };
      }
    } else if (hoverTimer.current) {
      clearTimeout(hoverTimer.current.t);
      hoverTimer.current = null;
    }
  }

  function onEnd() {
    const d = drag;
    if (d && hint) {
      if (hint.type === "root") apply(d, ROOT, (d.type === "f" ? draft.kidsF : draft.kidsB)[ROOT]?.length ?? 0);
      else if (hint.zone === "into") apply(d, hint.id, (d.type === "f" ? draft.kidsF : draft.kidsB)[hint.id]?.length ?? 0);
      else {
        const parentKey = hint.type === "f" ? draftP.pf[hint.id] : draftP.pb[hint.id];
        const list = (hint.type === "f" ? draft.kidsF : draft.kidsB)[parentKey] ?? [];
        apply(d, parentKey, list.indexOf(hint.id) + (hint.zone === "after" ? 1 : 0));
      }
    }
    end();
  }

  function end() {
    setDrag(null);
    setHint(null);
    if (hoverTimer.current) clearTimeout(hoverTimer.current.t);
    hoverTimer.current = null;
  }

  function nudge(item: Item, dir: -1 | 1) {
    const pk = item.type === "f" ? draftP.pf[item.id] : draftP.pb[item.id];
    const list = (item.type === "f" ? draft.kidsF : draft.kidsB)[pk] ?? [];
    const i = list.indexOf(item.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    apply(item, pk, dir === 1 ? j + 1 : j);
  }

  /* ---------- rendering ---------- */

  function count(t: Tree, id: Key): number {
    return (t.kidsB[id]?.length ?? 0) + (t.kidsF[id] ?? []).reduce((n, c) => n + count(t, c), 0);
  }

  function renderTree(t: Tree, key: Key, depth: number, editable: boolean): ReactNode {
    const open = editable ? openR : openL;
    const setOpen = editable ? setOpenR : setOpenL;
    const p = editable ? draftP : origP;
    const fIds = t.kidsF[key] ?? [];
    const bIds = t.kidsB[key] ?? [];
    if (!fIds.length && !bIds.length) {
      return depth > 0 ? (
        <li className="py-1.5 text-xs italic text-muted/70" style={{ paddingLeft: depth * 20 + 40 }}>Empty</li>
      ) : null;
    }
    return (
      <>
        {fIds.map((id) => {
          const f = byF.get(id)!;
          const isOpen = open.has(id);
          const moved = editable && origP.pf[id] !== p.pf[id];
          const h = editable && hint?.type === "f" && hint.id === id ? hint.zone : null;
          return (
            <li key={id}>
              <Row
                uid={editable ? `f:${id}` : null}
                style={{ paddingLeft: depth * 20 + 6 }}
                className={cn(
                  "group relative flex min-h-10 items-center gap-2 rounded-lg pr-2",
                  h === "into" ? "bg-accent/15 ring-1 ring-accent" : "hover:bg-elevated/60",
                  moved && "shadow-[inset_3px_0_0_var(--color-accent)]",
                )}
              >
                {h === "before" && <span className="drop-line top-0" />}
                {h === "after" && <span className="drop-line bottom-0" />}
                {editable && <GripVertical className="h-4 w-4 shrink-0 text-muted/50" aria-hidden />}
                <button
                  type="button"
                  aria-label={isOpen ? `Collapse ${f.name}` : `Expand ${f.name}`}
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpen((s) => {
                      const n = new Set(s);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:text-text"
                >
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                </button>
                {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-accent" /> : <Folder className="h-4 w-4 shrink-0 text-accent" />}
                <span dir="auto" className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{f.name}</span>
                {key === ROOT && f.isProject && (
                  <span className="shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">Project</span>
                )}
                {moved && <span className="shrink-0 text-[11px] font-semibold text-accent">Moved</span>}
                <span className="shrink-0 text-xs text-muted">{count(t, id)}</span>
                {editable && <RowActions item={{ type: "f", id }} name={f.name} onMove={setMoveDlg} onNudge={nudge} />}
              </Row>
              {isOpen && <ul>{renderTree(t, id, depth + 1, editable)}</ul>}
            </li>
          );
        })}
        {bIds.map((id) => {
          const b = byB.get(id)!;
          const moved = editable && origP.pb[id] !== p.pb[id];
          const h = editable && hint?.type === "b" && hint.id === id ? hint.zone : null;
          return (
            <li key={id}>
              <Row
                uid={editable ? `b:${id}` : null}
                style={{ paddingLeft: depth * 20 + 6 }}
                className={cn(
                  "group relative flex min-h-10 items-center gap-2 rounded-lg pr-2 hover:bg-elevated/60",
                  moved && "shadow-[inset_3px_0_0_var(--color-accent)]",
                )}
              >
                {h === "before" && <span className="drop-line top-0" />}
                {h === "after" && <span className="drop-line bottom-0" />}
                {editable && <GripVertical className="h-4 w-4 shrink-0 text-muted/50" aria-hidden />}
                <span className="w-6 shrink-0" />
                {b.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.faviconUrl} alt="" className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-elevated text-[9px] font-bold text-muted">
                    {(b.title || b.domain).charAt(0).toUpperCase()}
                  </span>
                )}
                <span dir="auto" className="min-w-0 flex-1 truncate text-left text-sm">{b.title}</span>
                <span className="hidden max-w-40 shrink-0 truncate text-xs text-muted xl:block">{b.domain}</span>
                {moved && <span className="shrink-0 text-[11px] font-semibold text-accent">Moved</span>}
                {editable && <RowActions item={{ type: "b", id }} name={b.title} onMove={setMoveDlg} onNudge={nudge} />}
              </Row>
            </li>
          );
        })}
      </>
    );
  }

  const homeRow = (editable: boolean) => (
    <RootRow editable={editable} active={editable && hint?.type === "root"} dragging={!!drag} />
  );

  const changesLabel = dirty
    ? [movedF + movedB ? `${movedF + movedB} moved` : null, reordered ? `${reordered} reordered` : null].filter(Boolean).join(" · ") || "Unsaved changes"
    : "No changes yet";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold tracking-tight">Organize</h1>
          <p className={cn("text-sm", dirty ? "text-accent" : "text-muted")}>{changesLabel}</p>
        </div>
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(original)}>
          <RotateCcw className="h-4 w-4" /> Discard
        </Button>
        <Button variant="primary" disabled={!dirty || saving} onClick={save}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Phones/tablets: tabs. Desktop: side by side. */}
      <div role="tablist" aria-label="View" className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1 lg:hidden">
        {(["current", "edit"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("h-10 flex-1 rounded-lg text-sm font-semibold", tab === k ? "bg-elevated text-text" : "text-muted")}
          >
            {k === "current" ? "Current" : "Edit"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Current structure" className={cn("pane", tab !== "current" && "max-lg:hidden")}>
          <header className="pane-head">
            <span>Current</span>
            <span className="text-xs font-normal text-muted">Read only</span>
          </header>
          <div className="pane-body">
            {homeRow(false)}
            <ul>{renderTree(original, ROOT, 0, false)}</ul>
          </div>
        </section>

        <section aria-label="Edit structure" className={cn("pane border-accent/40", tab !== "edit" && "max-lg:hidden")}>
          <header className="pane-head">
            <span>Edit</span>
            <span className="text-xs font-normal text-muted">
              <span className="hidden lg:inline">Drag onto a folder to move inside it, or between rows to reorder.</span>
              <span className="lg:hidden">Use ⇄ to move, ↑ ↓ to reorder.</span>
            </span>
          </header>
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onStart}
            onDragMove={onMove}
            onDragEnd={onEnd}
            onDragCancel={end}
          >
            <div className={cn("pane-body", drag && "select-none")}>
              {homeRow(true)}
              <ul>{renderTree(draft, ROOT, 0, true)}</ul>
            </div>
            <DragOverlay dropAnimation={null}>
              {drag && (
                <div className="flex max-w-xs items-center gap-2 rounded-lg border border-accent bg-elevated px-3 py-2 text-sm font-semibold shadow-2xl shadow-black/60">
                  {drag.type === "f" ? <Folder className="h-4 w-4 text-accent" /> : <span className="h-2 w-2 rounded-full bg-accent" />}
                  <span dir="auto" className="truncate">{drag.type === "f" ? byF.get(drag.id)?.name : byB.get(drag.id)?.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </section>
      </div>

      {moveDlg && (
        <MoveDialog
          item={moveDlg}
          name={moveDlg.type === "f" ? byF.get(moveDlg.id)!.name : byB.get(moveDlg.id)!.title}
          folders={folders}
          draft={draft}
          pf={draftP.pf}
          current={moveDlg.type === "f" ? draftP.pf[moveDlg.id] : draftP.pb[moveDlg.id]}
          onClose={() => setMoveDlg(null)}
          onPick={(to) => {
            apply(moveDlg, to, (moveDlg.type === "f" ? draft.kidsF : draft.kidsB)[to]?.length ?? 0);
            setMoveDlg(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

const parseUid = (uid: string): Item | null => {
  const [t, id] = uid.split(":");
  return (t === "f" || t === "b") && id ? { type: t, id } : null;
};

/** A tree row. In the Edit pane (uid set) the whole row is draggable and a drop target. */
function Row({ uid, children, className, style }: { uid: string | null; children: ReactNode; className: string; style: CSSProperties }) {
  if (!uid) return <div className={className} style={style}>{children}</div>;
  return <DraggableRow uid={uid} className={className} style={style}>{children}</DraggableRow>;
}

function DraggableRow({ uid, children, className, style }: { uid: string; children: ReactNode; className: string; style: CSSProperties }) {
  const drag = useDraggable({ id: uid });
  const drop = useDroppable({ id: uid });
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.listeners}
      style={style}
      className={cn(className, "cursor-grab select-none active:cursor-grabbing", drag.isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}

function RootRow({ editable, active, dragging }: { editable: boolean; active: boolean; dragging: boolean }) {
  const content = (
    <>
      <Home className="h-4 w-4" /> Home
      {editable && dragging && <span className="ml-auto text-xs font-normal">Drop here for top level</span>}
    </>
  );
  const cls = cn(
    "mb-1 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold",
    active ? "bg-accent/15 text-text ring-1 ring-accent" : "text-muted",
  );
  if (!editable) return <div className={cls}>{content}</div>;
  return <DroppableRoot className={cls}>{content}</DroppableRoot>;
}

function DroppableRoot({ className, children }: { className: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: ROOT });
  return <div ref={setNodeRef} className={className}>{children}</div>;
}

function RowActions({
  item,
  name,
  onMove,
  onNudge,
}: {
  item: Item;
  name: string;
  onMove: (i: Item) => void;
  onNudge: (i: Item, d: -1 | 1) => void;
}) {
  const btn = "grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-text";
  return (
    <span
      className="flex shrink-0 items-center"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button type="button" className={btn} aria-label={`Move ${name} up`} onClick={() => onNudge(item, -1)}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" className={btn} aria-label={`Move ${name} down`} onClick={() => onNudge(item, 1)}>
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" className={btn} aria-label={`Move ${name} to another folder`} onClick={() => onMove(item)}>
        <ArrowRightLeft className="h-4 w-4" />
      </button>
    </span>
  );
}

function MoveDialog({
  item,
  name,
  folders,
  draft,
  pf,
  current,
  onClose,
  onPick,
}: {
  item: Item;
  name: string;
  folders: FolderRow[];
  draft: Tree;
  pf: Record<string, Key>;
  current: Key;
  onClose: () => void;
  onPick: (to: Key) => void;
}) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const rows: { id: Key; label: string; depth: number; disabled: boolean }[] = [
    { id: ROOT, label: "Home (top level)", depth: 0, disabled: current === ROOT },
  ];
  const visit = (k: Key, depth: number) => {
    for (const id of draft.kidsF[k] ?? []) {
      const blocked = item.type === "f" && (id === item.id || isInside(pf, id, item.id));
      rows.push({ id, label: byId.get(id)!.name, depth, disabled: blocked || id === current });
      if (!(item.type === "f" && id === item.id)) visit(id, depth + 1);
    }
  };
  visit(ROOT, 1);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Move “${name}”`} description="Choose where it goes. Nothing is saved until you press Save changes.">
      <ul className="-mx-2 max-h-[55vh] overflow-auto">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              disabled={r.disabled}
              onClick={() => onPick(r.id)}
              style={{ paddingLeft: r.depth * 18 + 10 }}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg pr-3 text-left text-sm hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              {r.id === ROOT ? <Home className="h-4 w-4 text-muted" /> : <Folder className="h-4 w-4 text-accent" />}
              <span dir="auto" className="truncate">{r.label}</span>
              {r.id === current && <span className="ml-auto text-xs text-muted">Current</span>}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
