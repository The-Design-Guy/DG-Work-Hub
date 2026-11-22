"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { atomic, db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { folder, image } = schema;
const MAX_BYTES = 1_500_000;

/** Checks the file's real bytes, not just the type it claims. */
function sniff(buf: Buffer): "image/webp" | "image/jpeg" | "image/png" | null {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

async function ownedFolder(ownerId: string, id: string) {
  const [row] = await db
    .select({ id: folder.id, coverImageId: folder.coverImageId })
    .from(folder)
    .where(and(eq(folder.id, id), eq(folder.ownerId, ownerId), isNull(folder.deletedAt)));
  return row ?? null;
}

export async function setFolderCover(folderId: string, form: FormData) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const, error: "Folder not found." };
  const f = await ownedFolder(user.id, folderId);
  if (!f) return { ok: false as const, error: "Folder not found." };

  const file = form.get("file");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No image received." };
  if (file.size > MAX_BYTES) return { ok: false as const, error: "Image is too large." };
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4000 || height > 4000) {
    return { ok: false as const, error: "Invalid image size." };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) return { ok: false as const, error: "Use a JPG, PNG or WebP image." };

  const [img] = await db
    .insert(image)
    .values({ ownerId: user.id, mime, data: buf, width, height })
    .returning({ id: image.id });

  await atomic([
    db.update(folder).set({ coverImageId: img.id, updatedAt: new Date() }).where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
    ...(f.coverImageId ? [db.delete(image).where(and(eq(image.id, f.coverImageId), eq(image.ownerId, user.id)))] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeFolderCover(folderId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(folderId).success) return { ok: false as const };
  const f = await ownedFolder(user.id, folderId);
  if (!f) return { ok: false as const };
  if (f.coverImageId) {
    await atomic([
      db.update(folder).set({ coverImageId: null, updatedAt: new Date() }).where(and(eq(folder.id, folderId), eq(folder.ownerId, user.id))),
      db.delete(image).where(and(eq(image.id, f.coverImageId), eq(image.ownerId, user.id))),
    ]);
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}
