import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getOptionalUser } from "@/lib/session";

/** Serves a stored image to its owner only. Ids change on replace, so caching is safe. */
export async function GET(_request: Request, ctx: RouteContext<"/api/images/[id]">) {
  const user = await getOptionalUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const [img] = await db
    .select({ mime: schema.image.mime, data: schema.image.data })
    .from(schema.image)
    .where(and(eq(schema.image.id, id), eq(schema.image.ownerId, user.id)));
  if (!img) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
