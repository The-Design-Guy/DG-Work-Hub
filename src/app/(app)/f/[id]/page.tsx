import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FolderContents } from "@/components/folder-contents";
import { getFolder } from "@/lib/data";
import { requireUser } from "@/lib/session";

export default async function FolderPage({ params }: PageProps<"/f/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getFolder(user.id, id);
  if (!data) notFound();

  return (
    <>
      <Breadcrumbs crumbs={data.crumbs} />
      <FolderContents key={id} folder={data.folder} subfolders={data.subfolders} bookmarks={data.bookmarks} />
    </>
  );
}
