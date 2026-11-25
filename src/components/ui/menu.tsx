"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "./button";

/** Click/tap/keyboard menu (never hover-only). */
export function Menu({
  trigger,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl border border-line bg-elevated p-1.5 shadow-2xl shadow-black/50 data-[state=open]:animate-[menu-in_120ms_ease-out]"
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface",
        danger ? "text-danger" : "text-text",
      )}
    >
      {icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </DM.Item>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}

export function MenuSub({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <DM.Sub>
      <DM.SubTrigger className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface data-[state=open]:bg-surface">
        {icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <span className="flex-1">{label}</span>
        <span aria-hidden className="text-muted">›</span>
      </DM.SubTrigger>
      <DM.Portal>
        <DM.SubContent
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl border border-line bg-elevated p-1.5 shadow-2xl shadow-black/50"
        >
          {children}
        </DM.SubContent>
      </DM.Portal>
    </DM.Sub>
  );
}
