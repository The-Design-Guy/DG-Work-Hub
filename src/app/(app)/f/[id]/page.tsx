import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FolderContents } from "@/components/folder-contents";
import { mockFolder } from "@/lib/mock";

export default async function FolderPage({ params }: PageProps<"/f/[id]">) {
  const { id } = await params;
  const { folder, subfolders, bookmarks, crumbs } = mockFolder(id);
  if (!folder) notFound();

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <FolderContents folder={folder} subfolders={subfolders} bookmarks={bookmarks} />
    </>
  );
}
