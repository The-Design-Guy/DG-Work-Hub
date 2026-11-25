"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { createSpace, deleteSpace, moveSpace, renameSpace } from "@/app/actions/spaces";
import type { SpaceView } from "@/lib/types";
import { Menu, MenuItem, MenuSeparator } from "./ui/menu";
import { Dialog, Field, inputClass } from "./ui/dialog";
import { Button, cn } from "./ui/button";

function rememberTab(id: string) {
  document.cookie = `dg_tab=${id}; path=/; max-age=31536000; samesite=lax`;
}

export function SpaceTabs({ spaces, active, counts }: { spaces: SpaceView[]; active: string; counts: Record<string, number> }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | { mode: "new" } | { mode: "rename"; space: SpaceView } | { mode: "delete"; space: SpaceView }>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const tabs = [{ id: "all", name: "All" }, ...spaces];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    setBusy(true);
    if (dialog.mode === "new") {
      const res = await createSpace(name);
      setBusy(false);
      if (!res.ok) return toast.error(res.error);
      rememberTab(res.id);
      router.push(`/?tab=${res.id}`);
    } else if (dialog.mode === "rename") {
      const res = await renameSpace(dialog.space.id, name);
      setBusy(false);
      if (!res.ok) return toast.error(res.error);
    } else {
      await deleteSpace(dialog.space.id);
      setBusy(false);
      rememberTab("all");
      router.push("/?tab=all");
      toast(`Tab “${dialog.space.name}” deleted. Its folders and links are under All.`);
    }
    setDialog(null);
  }

  return (
    <>
      <div role="tablist" aria-label="Home tabs" className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {tabs.map((t, i) => {
          const on = t.id === active;
          return (
            <div key={t.id} className={cn("flex shrink-0 items-center rounded-xl", on ? "bg-elevated" : "hover:bg-surface")}>
              <Link
                role="tab"
                aria-selected={on}
                href={`/?tab=${t.id}`}
                onClick={() => rememberTab(t.id)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                  on ? "text-text" : "text-muted hover:text-text",
                )}
              >
                <span dir="auto">{t.name}</span>
                <span className={cn("rounded-md px-1.5 text-xs", on ? "bg-accent/15 text-accent" : "bg-surface text-muted")}>{counts[t.id] ?? 0}</span>
              </Link>
              {on && t.id !== "all" && (
                <Menu
                  align="start"
                  trigger={
                    <button type="button" aria-label={`Options for ${t.name}`} className="mr-1 grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-text">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  }
                >
                  <MenuItem
                    icon={<Pencil />}
                    onSelect={() => {
                      setName(t.name);
                      setDialog({ mode: "rename", space: t });
                    }}
                  >
                    Rename tab
                  </MenuItem>
                  {i > 1 && <MenuItem icon={<ArrowLeft />} onSelect={() => moveSpace(t.id, -1)}>Move left</MenuItem>}
                  {i < tabs.length - 1 && <MenuItem icon={<ArrowRight />} onSelect={() => moveSpace(t.id, 1)}>Move right</MenuItem>}
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} danger onSelect={() => setDialog({ mode: "delete", space: t })}>
                    Delete tab
                  </MenuItem>
                </Menu>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setName("");
            setDialog({ mode: "new" });
          }}
          aria-label="Add tab"
          title="Add tab"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface hover:text-accent"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <Dialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "new" ? "New tab" : dialog?.mode === "rename" ? "Rename tab" : `Delete “${dialog?.mode === "delete" ? dialog.space.name : ""}”?`}
        description={dialog?.mode === "delete" ? "Only the tab goes away. Its folders and links stay, and show under All." : undefined}
      >
        <form onSubmit={submit} className="space-y-5">
          {dialog?.mode !== "delete" && (
            <Field label="Name">
              <input dir="auto" autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant={dialog?.mode === "delete" ? "danger" : "primary"} type="submit" disabled={busy}>
              {dialog?.mode === "new" ? "Add tab" : dialog?.mode === "rename" ? "Rename" : "Delete tab"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
