import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FolderContents } from "@/components/folder-contents";
import { getFolder } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { getSort, getView } from "@/lib/view";
import { sortBookmarks, sortFolders } from "@/lib/sort";

export default async function FolderPage({ params }: PageProps<"/f/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const [data, view, sort] = await Promise.all([getFolder(user.id, id), getView(), getSort()]);
  if (!data) notFound();

  return (
    <>
      <Breadcrumbs crumbs={data.crumbs} />
      <FolderContents key={id} folder={data.folder} subfolders={sortFolders(data.subfolders, sort)} bookmarks={sortBookmarks(data.bookmarks, sort)} view={view} sort={sort} />
    </>
  );
}
