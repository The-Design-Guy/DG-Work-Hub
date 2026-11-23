"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { safeFetch } from "@/lib/safe-fetch";
import { normalizeUrl } from "@/lib/url";
import { iconLinks, sniffImage } from "@/lib/page-meta";

const { folder, image, bookmark } = schema;

/* ------------------------------------------------------------------ */
/* Favicon discovery                                                    */
/* ------------------------------------------------------------------ */

type Candidate = { dataUrl: string; label: string };

export async function findFavicons(input: string): Promise<{ ok: true; site: string; candidates: Candidate[] } | { ok: false; error: string }> {
  await requireUser();
  const norm = normalizeUrl(input);
  if (!norm) return { ok: false, error: "Enter a website, like chatgpt.com" };
  const page = new URL(norm.url);

  let links: { href: string; score: number; label: string }[] = [];
  let origin = page.origin;
  try {
    const res = await safeFetch(page.href, { maxBytes: 800_000, accept: "text/html" });
    origin = res.url.origin;
    if (res.type.includes("html")) links = iconLinks(res.body.toString("utf8"), res.url);
  } catch {
    // The page itself may be private or blocked; still try the usual icon paths.
  }
  links.push(
    { href: `${origin}/apple-touch-icon.png`, score: 180, label: "180px" },
    { href: `${origin}/favicon.ico`, score: 16, label: "favicon.ico" },
  );
  const unique = [...new Map(links.sort((a, b) => b.score - a.score).map((l) => [l.href, l])).values()].slice(0, 6);

  const results = await Promise.allSettled(
    unique.map(async (l) => {
      const r = await safeFetch(l.href, { maxBytes: 250_000, accept: "image/*" });
      const mime = sniffImage(r.body);
      if (!mime) throw new Error("Not an image");
      return { dataUrl: `data:${mime};base64,${r.body.toString("base64")}`, label: l.label };
    }),
  );
  const seen = new Set<string>();
  const candidates = results
    .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
    .filter((c) => (seen.has(c.dataUrl) ? false : (seen.add(c.dataUrl), true)));
  if (!candidates.length) return { ok: false, error: `Couldn't find an icon for ${norm.domain}.` };
  return { ok: true, site: norm.domain, candidates };
}

/** Sites used inside a folder (and its subfolders), as one-click suggestions. */
export async function folderDomains(folderId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return [];
  const res = await db.execute(sql`
    with recursive tree as (
      select id from ${folder} where id = ${folderId} and owner_id = ${user.id}
      union all
      select f.id from ${folder} f join tree t on f.parent_id = t.id where f.owner_id = ${user.id} and f.deleted_at is null
    )
    select b.domain, count(*)::int as n from ${bookmark} b
    where b.owner_id = ${user.id} and b.deleted_at is null and b.folder_id in (select id from tree)
    group by b.domain order by n desc limit 12`);
  const rows = (res && typeof res === "object" && "rows" in res ? (res as unknown as { rows: { domain: string }[] }).rows : (res as unknown as { domain: string }[])) ?? [];
  return rows.map((r) => r.domain);
}

/* ------------------------------------------------------------------ */
/* Save / remove                                                        */
/* ------------------------------------------------------------------ */

function sniffStored(buf: Buffer) {
  const m = sniffImage(buf);
  return m === "image/png" || m === "image/webp" || m === "image/jpeg" ? m : null;
}

export async function setFolderIcon(folderId: string, form: FormData) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const, error: "Folder not found." };
  const [f] = await db
    .select({ id: folder.id, iconImageId: folder.iconImageId })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id), isNull(folder.deletedAt)));
  if (!f) return { ok: false as const, error: "Folder not found." };

  const file = form.get("file");
  const size = Number(form.get("size"));
  if (!(file instanceof File) || file.size === 0 || file.size > 400_000) return { ok: false as const, error: "Invalid image." };
  if (!Number.isInteger(size) || size < 16 || size > 1024) return { ok: false as const, error: "Invalid image size." };
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffStored(buf);
  if (!mime) return { ok: false as const, error: "Invalid image." };

  const [img] = await db.insert(image).values({ ownerId: user.id, mime, data: buf, width: size, height: size }).returning({ id: image.id });
  await atomic([
    db.update(folder).set({ iconImageId: img.id, updatedAt: new Date() }).where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
    ...(f.iconImageId ? [db.delete(image).where(and(eq(image.id, f.iconImageId), eq(image.ownerId, user.id)))] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeFolderIcon(folderId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const };
  const [f] = await db
    .select({ iconImageId: folder.iconImageId })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id)));
  if (f?.iconImageId) {
    await atomic([
      db.update(folder).set({ iconImageId: null, updatedAt: new Date() }).where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
      db.delete(image).where(and(eq(image.id, f.iconImageId), eq(image.ownerId, user.id))),
    ]);
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}
