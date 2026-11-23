export type FolderLite = { id: string; parentId: string | null; name: string };

/** Folders as an indented list, in tree order, for <select> pickers. */
export function folderOptions(folders: FolderLite[]) {
  const byParent = new Map<string | null, FolderLite[]>();
  for (const f of folders) byParent.set(f.parentId, [...(byParent.get(f.parentId) ?? []), f]);
  const out: { id: string; label: string }[] = [];
  const visit = (pid: string | null, depth: number) => {
    for (const f of byParent.get(pid) ?? []) {
      out.push({ id: f.id, label: `${"   ".repeat(depth)}${depth ? "↳ " : ""}${f.name}` });
      visit(f.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}
