import Link from "next/link";
import { Upload } from "lucide-react";
import { BookmarkGrid, FolderGrid } from "@/components/folder-contents";
import { EmptyState } from "@/components/empty-state";
import { buttonClass } from "@/components/ui/button";
import { getRoot } from "@/lib/data";
import { requireUser } from "@/lib/session";

export default async function Home() {
  const user = await requireUser();
  const { folders, bookmarks } = await getRoot(user.id);

  if (!folders.length && !bookmarks.length) {
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

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your folders</h1>
      <p className="mt-1 text-sm text-muted">
        {folders.length} {folders.length === 1 ? "folder" : "folders"}
        {bookmarks.length > 0 && ` · ${bookmarks.length} ${bookmarks.length === 1 ? "link" : "links"}`}
      </p>
      {folders.length > 0 && (
        <section className="mt-8" aria-label="Folders">
          <FolderGrid folders={folders} />
        </section>
      )}
      {bookmarks.length > 0 && (
        <section className="mt-10" aria-labelledby="root-links">
          <h2 id="root-links" className="section-title">Links</h2>
          <BookmarkGrid bookmarks={bookmarks} />
        </section>
      )}
    </>
  );
}
