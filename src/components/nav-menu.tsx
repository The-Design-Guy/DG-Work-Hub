"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, FolderTree, Home, LogOut, Puzzle, Trash2, Upload, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "./ui/button";

/** The Design Guy slanted-lines burger (same mark as The 15 Project). */
function BurgerMark() {
  return (
    <svg viewBox="0 0 500 500" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M416.19,83.81c-8.35-8.34-21.87-8.34-30.22,0L83.81,385.97c-8.34,8.34-8.34,21.87,0,30.22,4.17,4.17,9.64,6.26,15.11,6.26s10.94-2.09,15.11-6.26L416.19,114.03c8.34-8.34,8.34-21.87,0-30.22Z" />
      <path d="M96.51,197.23l100.72-100.72c8.34-8.34,8.34-21.87,0-30.22s-21.87-8.34-30.22,0l-100.72,100.72c-8.34,8.34-8.34,21.87,0,30.22,4.17,4.17,9.64,6.26,15.11,6.26s10.94-2.09,15.11-6.26Z" />
      <path d="M433.71,302.77c-8.34-8.34-21.87-8.34-30.22,0l-100.72,100.72c-8.34,8.34-8.34,21.87,0,30.22,4.17,4.17,9.64,6.26,15.11,6.26s10.94-2.09,15.11-6.26l100.72-100.72c8.34-8.34,8.34-21.87,0-30.22Z" />
    </svg>
  );
}

type Item = { label: string; icon: ReactNode; href?: string; onClick?: () => void; soon?: boolean };

export function NavMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const pathname = usePathname();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);


  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const items: Item[] = [
    { label: "Home", icon: <Home />, href: "/" },
    { label: "Organize", icon: <FolderTree />, href: "/organize" },
    { label: "Import Chrome bookmarks", icon: <Upload />, href: "/import" },
    { label: "Export (HTML / JSON)", icon: <Download />, soon: true },
    { label: "Trash", icon: <Trash2 />, soon: true },
    { label: "Chrome extension", icon: <Puzzle />, soon: true },
  ];

  const panel = (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[60] bg-black/70 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={cn(
          "fixed inset-0 z-[61] flex flex-col overflow-auto bg-[#0e0f11] px-4 pb-[calc(22px+env(safe-area-inset-bottom))] pt-3 transition-[transform,visibility] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] sm:px-8",
          open ? "visible translate-y-0" : "invisible -translate-y-[105%]",
        )}
      >
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
          <div className="flex items-center justify-between py-1">
            <Link href="/" className="flex items-center gap-3 rounded-xl" onClick={() => setOpen(false)}>
              <Image src="/brand/dg-head.svg" alt="" width={48} height={48} />
              <span className="flex flex-col gap-1.5">
                <Image src="/brand/dg-wordmark.svg" alt="Design Guy" width={197} height={24} className="h-6 w-auto" />
                <span className="font-heading text-[11px] font-medium uppercase leading-none tracking-[0.32em]">
                  The Work Hub
                </span>
              </span>
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-12 w-12 place-items-center rounded-xl bg-surface text-text hover:bg-elevated"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="mt-10 flex w-full max-w-xl flex-col gap-1.5">
            {items.map((it) => {
              const current = it.href && (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href));
              const cls = cn(
                "flex h-14 items-center gap-4 rounded-xl px-4 text-base font-semibold transition-colors [&_svg]:h-5 [&_svg]:w-5",
                current ? "bg-accent/12 text-accent" : "text-text hover:bg-surface",
                it.soon && "cursor-default text-muted hover:bg-transparent",
              );
              const inner = (
                <>
                  <span className={current ? "text-accent" : "text-muted"}>{it.icon}</span>
                  {it.label}
                  {it.soon && (
                    <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                      Soon
                    </span>
                  )}
                </>
              );
              return it.href && !it.soon ? (
                <Link key={it.label} href={it.href} aria-current={current ? "page" : undefined} className={cls} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <div key={it.label} className={cls} aria-disabled>
                  {inner}
                </div>
              );
            })}
            <button
              type="button"
              onClick={async () => {
                await authClient.signOut();
                router.replace("/login");
              }}
              className="flex h-14 items-center gap-4 rounded-xl px-4 text-base font-semibold text-text hover:bg-surface [&_svg]:h-5 [&_svg]:w-5"
            >
              <span className="text-muted"><LogOut /></span>
              Sign out
            </button>
          </nav>

          <div className="mt-auto flex flex-col gap-3 px-4 pt-10">
            <span className="text-xs text-muted">Signed in as {email}</span>
            <div aria-hidden className="h-px bg-line" />
            <span className="text-xs text-muted">
              © {new Date().getFullYear()}{" "}
              <a href="https://www.the-design-guy.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                The Design Guy LLC
              </a>
              . All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-accent transition-colors hover:bg-surface"
      >
        <span className="relative block h-6 w-6">
          <span className={cn("absolute inset-0 flex transition-[opacity,transform] duration-300", open ? "rotate-90 scale-60 opacity-0" : "opacity-100")}>
            <BurgerMark />
          </span>
          <span className={cn("absolute inset-0 flex transition-[opacity,transform] duration-300", open ? "opacity-100" : "-rotate-90 scale-60 opacity-0")}>
            <X className="h-6 w-6" />
          </span>
        </span>
      </button>
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
