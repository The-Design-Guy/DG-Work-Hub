"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Folder, Link2, RotateCcw } from "lucide-react";
import { restoreBatch } from "@/app/actions/trash";
import type { TrashBatch } from "@/lib/data";
import { Button } from "./ui/button";
import { EmptyState } from "./empty-state";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function TrashList({ batches }: { batches: TrashBatch[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!batches.length) return <EmptyState title="Trash is empty" text="Deleted folders and links show up here, ready to restore." />;

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {batches.map((b) => {
        const first = b.top[0];
        const more = b.top.length - 1;
        const contents = [
          b.folders ? `${b.folders} ${b.folders === 1 ? "folder" : "folders"}` : null,
          b.links ? `${b.links} ${b.links === 1 ? "link" : "links"}` : null,
        ].filter(Boolean);
        return (
          <li key={b.batch} className="flex items-center gap-4 p-4 sm:px-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-elevated">
              {first.type === "f" ? <Folder className="h-5 w-5 text-accent" /> : <Link2 className="h-5 w-5 text-muted" />}
            </span>
            <div className="min-w-0 flex-1">
              <p dir="auto" className="line-clamp-2 text-left font-semibold">
                {first.name}
                {more > 0 && <span className="font-normal text-muted"> and {more} more</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {contents.join(" · ")} · deleted {fmt(b.deletedAt)}
              </p>
            </div>
            <Button
              size="sm"
              disabled={busy === b.batch}
              onClick={async () => {
                setBusy(b.batch);
                const res = await restoreBatch(b.batch);
                setBusy(null);
                if (res.ok) toast.success("Restored");
                else toast.error("Couldn't restore.");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Restore
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
