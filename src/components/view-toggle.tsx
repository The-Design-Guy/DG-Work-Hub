"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "./ui/button";

function saveView(v: "cards" | "list") {
  document.cookie = `dg_view=${v}; path=/; max-age=31536000; samesite=lax`;
}

export function ViewToggle({ view }: { view: "cards" | "list" }) {
  const router = useRouter();
  const set = (v: "cards" | "list") => {
    saveView(v);
    router.refresh();
  };
  const btn = (v: "cards" | "list", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={view === v}
      aria-label={label}
      title={label}
      onClick={() => set(v)}
      className={cn(
        "grid h-9 w-10 place-items-center rounded-lg transition-colors [&_svg]:h-4.5 [&_svg]:w-4.5",
        view === v ? "bg-elevated text-accent" : "text-muted hover:text-text",
      )}
    >
      {icon}
    </button>
  );
  return (
    <div role="group" aria-label="View" className="flex shrink-0 rounded-xl border border-line bg-surface p-1">
      {btn("cards", "Cards", <LayoutGrid />)}
      {btn("list", "List", <List />)}
    </div>
  );
}
