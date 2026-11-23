"use client";

import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUpDown, ArrowUpZA, Check, Clock, GripVertical, Rocket } from "lucide-react";
import type { Sort } from "@/lib/types";
import { Menu, MenuItem } from "./ui/menu";

const OPTIONS: { value: Sort; label: string; icon: React.ReactNode }[] = [
  { value: "custom", label: "My order", icon: <GripVertical /> },
  { value: "az", label: "Name A–Z", icon: <ArrowDownAZ /> },
  { value: "za", label: "Name Z–A", icon: <ArrowUpZA /> },
  { value: "modified", label: "Last modified", icon: <Clock /> },
  { value: "launched", label: "Last launched", icon: <Rocket /> },
];

function saveSort(v: Sort) {
  document.cookie = `dg_sort=${v}; path=/; max-age=31536000; samesite=lax`;
}

export function SortMenu({ sort }: { sort: Sort }) {
  const router = useRouter();
  const current = OPTIONS.find((o) => o.value === sort) ?? OPTIONS[0];
  return (
    <Menu
      trigger={
        <button
          type="button"
          aria-label={`Sort: ${current.label}`}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted hover:text-text data-[state=open]:text-text"
        >
          <ArrowUpDown className="h-4 w-4" />
          <span className="hidden sm:inline">{current.label}</span>
        </button>
      }
    >
      {OPTIONS.map((o) => (
        <MenuItem
          key={o.value}
          icon={o.icon}
          onSelect={() => {
            saveSort(o.value);
            router.refresh();
          }}
        >
          <span className="flex-1">{o.label}</span>
          {o.value === sort && <Check className="h-4 w-4 text-accent" />}
        </MenuItem>
      ))}
    </Menu>
  );
}
