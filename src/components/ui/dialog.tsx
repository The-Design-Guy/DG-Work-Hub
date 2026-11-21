"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <D.Content className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-2xl shadow-black/60 data-[state=open]:animate-[dialog-in_180ms_ease-out] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <D.Title className="font-heading text-lg font-semibold">{title}</D.Title>
              {description && <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>}
            </div>
            <D.Close className="-m-2 rounded-lg p-2 text-muted hover:text-text" aria-label="Close">
              <X className="h-5 w-5" />
            </D.Close>
          </div>
          <div className="mt-6">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-muted/70 focus:border-accent focus:outline-none";
