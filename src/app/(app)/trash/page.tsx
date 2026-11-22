import { Breadcrumbs } from "@/components/breadcrumbs";
import { TrashList } from "@/components/trash-list";
import { getTrash } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Trash" };

export default async function TrashPage() {
  const user = await requireUser();
  const batches = await getTrash(user.id);
  return (
    <>
      <Breadcrumbs crumbs={[{ id: null, name: "Home" }, { id: "trash", name: "Trash" }]} />
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Trash</h1>
      <p className="mt-1 text-sm text-muted">Deleted folders come back with everything that was inside them.</p>
      <div className="mt-8">
        <TrashList batches={batches} />
      </div>
    </>
  );
}
