import Link from "next/link";
import { cookies } from "next/headers";
import { FolderTree, Upload } from "lucide-react";
import { BookmarkGrid, FolderGrid } from "@/components/folder-contents";
import { EmptyState } from "@/components/empty-state";
import { SpaceTabs } from "@/components/space-tabs";
import { SortMenu } from "@/components/sort-menu";
import { ViewToggle } from "@/components/view-toggle";
import { buttonClass } from "@/components/ui/button";
import { getRoot, getSpaces } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { sortBookmarks, sortFolders } from "@/lib/sort";
import { getSort, getView } from "@/lib/view";
import type { BookmarkView, FolderView } from "@/lib/types";

function Section({
  title,
  folders,
  bookmarks,
  view,
}: {
  title?: string;
  folders: FolderView[];
  bookmarks: BookmarkView[];
  view: "cards" | "list";
}) {
  return (
    <section className="mt-8 first:mt-6" aria-label={title}>
      {title && <h2 className="mb-4 text-xl font-bold tracking-tight" dir="auto">{title}</h2>}
      {folders.length > 0 && <FolderGrid folders={folders} view={view} />}
      {bookmarks.length > 0 && (
        <div className={folders.length ? "mt-5" : ""}>
          <BookmarkGrid bookmarks={bookmarks} view={view} />
        </div>
      )}
    </section>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const [root, spaces, view, sort, sp, jar] = await Promise.all([
    getRoot(user.id),
    getSpaces(user.id),
    getView(),
    getSort(),
    searchParams,
    cookies(),
  ]);

  if (!root.folders.length && !root.bookmarks.length && !spaces.length) {
    return (
      <EmptyState
        title="Let's fill this up"
        text="Bring in your Chrome bookmarks and pick exactly what to keep, or start with a new folder."
        action={
          <Link href="/import" className={buttonClass("primary", "md")}>
            <Upload className="h-4.5 w-4.5" />
            Import from Chrome
          </Link>
        }
      />
    );
  }

  const requested = (typeof sp.tab === "string" ? sp.tab : null) ?? jar.get("dg_tab")?.value ?? "all";
  const known = new Set(spaces.map((s) => s.id));
  const active = known.has(requested) ? requested : "all";

  const folders = sortFolders(root.folders, sort);
  const bookmarks = sortBookmarks(root.bookmarks, sort);
  const inSpace = (id: string | null) => ({
    folders: folders.filter((f) => (id ? f.spaceId === id : !f.spaceId || !known.has(f.spaceId))),
    bookmarks: bookmarks.filter((b) => (id ? b.spaceId === id : !b.spaceId || !known.has(b.spaceId))),
  });

  const counts: Record<string, number> = { all: folders.length + bookmarks.length };
  for (const s of spaces) {
    const c = inSpace(s.id);
    counts[s.id] = c.folders.length + c.bookmarks.length;
  }
  const current = active === "all" ? null : spaces.find((s) => s.id === active)!;
  const shown = current ? inSpace(current.id) : null;
  const loose = inSpace(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SpaceTabs spaces={spaces} active={active} counts={counts} />
        <div className="flex items-center gap-2">
          <SortMenu sort={sort} />
          <ViewToggle view={view} />
          <Link href="/organize" className={buttonClass("secondary", "md")}>
            <FolderTree className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Organize</span>
          </Link>
        </div>
      </div>

      {current && shown ? (
        shown.folders.length || shown.bookmarks.length ? (
          <Section folders={shown.folders} bookmarks={shown.bookmarks} view={view} />
        ) : (
          <div className="mt-8">
            <EmptyState
              title={`Nothing in “${current.name}” yet`}
              text="Create a folder while this tab is open, or move one here from its ⋯ menu → Move to tab."
            />
          </div>
        )
      ) : (
        <>
          {spaces.map((s) => {
            const c = inSpace(s.id);
            return c.folders.length || c.bookmarks.length ? (
              <Section key={s.id} title={s.name} folders={c.folders} bookmarks={c.bookmarks} view={view} />
            ) : null;
          })}
          {(loose.folders.length > 0 || loose.bookmarks.length > 0) && (
            <Section title="Not in a tab" folders={loose.folders} bookmarks={loose.bookmarks} view={view} />
          )}
        </>
      )}
    </>
  );
}
