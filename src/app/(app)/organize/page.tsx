import { OrganizeView } from "@/components/organize-view";
import { getFullTree } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Organize" };

export default async function OrganizePage({ searchParams }: PageProps<"/organize">) {
  const user = await requireUser();
  const sp = await searchParams;
  const focus = typeof sp.focus === "string" ? sp.focus : undefined;
  const { folders, bookmarks } = await getFullTree(user.id);
  return <OrganizeView folders={folders} links={bookmarks} focus={focus} />;
}
