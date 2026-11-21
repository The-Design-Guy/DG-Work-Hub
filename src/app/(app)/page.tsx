import { FolderGrid } from "@/components/folder-contents";
import { mockFolders } from "@/lib/mock";

export default function Home() {
  const roots = mockFolders.filter((f) => f.parentId === null);
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your folders</h1>
          <p className="mt-1 text-sm text-muted">{roots.length} folders</p>
        </div>
      </div>
      <section className="mt-8" aria-label="Folders">
        <FolderGrid folders={roots} />
      </section>
    </>
  );
}
