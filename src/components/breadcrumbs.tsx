import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { Crumb } from "@/lib/types";

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const href = c.id ? `/f/${c.id}` : "/";
          return (
            <li key={c.id ?? "home"} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-text">
                  {c.name}
                </span>
              ) : (
                <Link href={href} className="flex items-center gap-1.5 truncate rounded-md px-1 hover:text-text">
                  {!c.id && <Home className="h-4 w-4" aria-hidden />}
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
