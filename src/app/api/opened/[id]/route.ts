import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getOptionalUser } from "@/lib/session";

/** Notes when a link was last opened from the app (for "Last launched" sorting). */
export async function POST(request: Request, ctx: RouteContext<"/api/opened/[id]">) {
  // Same-origin only.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return new Response(null, { status: 403 });
  const user = await getOptionalUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  await db
    .update(schema.bookmark)
    .set({ lastLaunchedAt: new Date() })
    .where(and(eq(schema.bookmark.id, id), eq(schema.bookmark.ownerId, user.id), isNull(schema.bookmark.deletedAt)));
  return new Response(null, { status: 204 });
}
