/**
 * Parses Chrome's exported bookmarks file (Netscape Bookmark File format) in
 * the browser. The raw file never leaves the device; only the items you pick
 * are sent to the server.
 */

export type TreeNode =
  | { id: string; kind: "folder"; title: string; children: TreeNode[] }
  | { id: string; kind: "link"; title: string; url: string; icon: string | null };

let seq = 0;
const nextId = () => `n${++seq}`;

function parseList(dl: Element): TreeNode[] {
  const out: TreeNode[] = [];
  // Browsers' HTML parser nests <DT> oddly in these files, so walk direct DT children
  // and also tolerate <p> wrappers.
  const items = Array.from(dl.children).flatMap((c) =>
    c.tagName === "DT" ? [c] : c.tagName === "P" ? Array.from(c.children).filter((x) => x.tagName === "DT") : [],
  );
  for (const dt of items) {
    const h3 = dt.querySelector(":scope > h3");
    const a = dt.querySelector(":scope > a");
    if (h3) {
      let sub = dt.querySelector(":scope > dl");
      if (!sub) {
        const next = dt.nextElementSibling;
        if (next?.tagName === "DD") sub = next.querySelector(":scope > dl");
        else if (next?.tagName === "DL") sub = next;
      }
      out.push({
        id: nextId(),
        kind: "folder",
        title: (h3.textContent ?? "").trim() || "Untitled folder",
        children: sub ? parseList(sub) : [],
      });
    } else if (a) {
      const href = a.getAttribute("href") ?? "";
      out.push({
        id: nextId(),
        kind: "link",
        title: (a.textContent ?? "").trim(),
        url: href.trim(),
        icon: a.getAttribute("icon"),
      });
    }
  }
  return out;
}

export function parseChromeBookmarks(html: string): TreeNode[] {
  seq = 0;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector("dl");
  if (!root) throw new Error("This doesn't look like a Chrome bookmarks file.");
  return parseList(root);
}

/* ---------- helpers used by the import screen ---------- */

export function walk(nodes: TreeNode[], fn: (n: TreeNode, parents: TreeNode[]) => void, parents: TreeNode[] = []) {
  for (const n of nodes) {
    fn(n, parents);
    if (n.kind === "folder") walk(n.children, fn, [...parents, n]);
  }
}

/** Ids of every link and every empty folder below (and including) a node. */
export function leafIds(n: TreeNode): string[] {
  if (n.kind === "link") return [n.id];
  if (n.children.length === 0) return [n.id];
  return n.children.flatMap(leafIds);
}

export type PayloadNode =
  | { t: "f"; title: string; children: PayloadNode[] }
  | { t: "l"; title: string; url: string; icon?: string | null };

/** Keeps only selected items, recreating the folders that contain them. */
export function buildPayload(
  nodes: TreeNode[],
  selected: Set<string>,
  opts: { unwrapTop: boolean; skip: Set<string>; includeIcons: boolean },
): PayloadNode[] {
  const conv = (list: TreeNode[]): PayloadNode[] =>
    list.flatMap((n): PayloadNode[] => {
      if (n.kind === "link") {
        if (!selected.has(n.id) || opts.skip.has(n.id)) return [];
        return [{ t: "l", title: n.title, url: n.url, icon: opts.includeIcons ? n.icon : null }];
      }
      if (n.children.length === 0) return selected.has(n.id) ? [{ t: "f", title: n.title, children: [] }] : [];
      const kids = conv(n.children);
      return kids.length ? [{ t: "f", title: n.title, children: kids }] : [];
    });
  const out = conv(nodes);
  return opts.unwrapTop ? out.flatMap((n) => (n.t === "f" ? n.children : [n])) : out;
}
