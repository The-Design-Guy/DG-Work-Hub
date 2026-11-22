"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const { bookmark } = schema;

export async function setLaunch(id: string, value: boolean) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false as const };
  const rows = await db
    .update(bookmark)
    .set({ launchOnStart: value, updatedAt: new Date() })
    .where(and(eq(bookmark.id, id), eq(bookmark.ownerId, user.id), isNull(bookmark.deletedAt)))
    .returning({ id: bookmark.id });
  revalidatePath("/", "layout");
  return { ok: rows.length === 1 };
}
