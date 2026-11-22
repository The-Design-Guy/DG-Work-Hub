import { Breadcrumbs } from "@/components/breadcrumbs";
import { ImportWizard } from "@/components/import-wizard";
import { getExistingUrls, getFolderTree } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const [folders, existingUrls] = await Promise.all([getFolderTree(user.id), getExistingUrls(user.id)]);

  return (
    <>
      <Breadcrumbs crumbs={[{ id: null, name: "Home" }, { id: "import", name: "Import" }]} />
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Import Chrome bookmarks</h1>
      <p className="mt-1 text-sm text-muted">Pick exactly which bookmarks to bring in, and where they go.</p>
      <div className="mt-8">
        <ImportWizard folders={folders} existingUrls={existingUrls} />
      </div>
    </>
  );
}
