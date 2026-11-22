import Link from "next/link";
import { Upload } from "lucide-react";
import { BookmarkGrid, FolderGrid } from "@/components/folder-contents";
import { EmptyState } from "@/components/empty-state";
import { buttonClass } from "@/components/ui/button";
import { getRoot } from "@/lib/data";
import { requireUser } from "@/lib/session";

export default async function Home() {
  const user = await requireUser();
  const { projects, library, bookmarks } = await getRoot(user.id);

  if (!projects.length && !library.length && !bookmarks.length) {
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
      <section aria-labelledby="projects-h">
        <h1 id="projects-h" className="text-3xl font-bold tracking-tight sm:text-4xl">Projects</h1>
        <p className="mt-1 text-sm text-muted">
          {projects.length
            ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
            : "No projects yet. Open a folder's ⋯ menu and choose “Make it a project”."}
        </p>
        {projects.length > 0 && (
          <div className="mt-8">
            <FolderGrid folders={projects} />
          </div>
        )}
      </section>

      {library.length > 0 && (
        <section className="mt-14" aria-labelledby="library-h">
          <h2 id="library-h" className="text-2xl font-bold tracking-tight">Library</h2>
          <p className="mt-1 text-sm text-muted">
            {library.length} {library.length === 1 ? "folder" : "folders"}
          </p>
          <div className="mt-6">
            <FolderGrid folders={library} />
          </div>
        </section>
      )}

      {bookmarks.length > 0 && (
        <section className="mt-14" aria-labelledby="root-links">
          <h2 id="root-links" className="text-2xl font-bold tracking-tight">Links</h2>
          <div className="mt-6">
            <BookmarkGrid bookmarks={bookmarks} />
          </div>
        </section>
      )}
    </>
  );
}
