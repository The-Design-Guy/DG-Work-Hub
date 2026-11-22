import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NeonHttpDatabase<typeof schema>;
let instance: DB | null = null;
let isLocal = false;

function getDb(): DB {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const host = new URL(url).hostname;
    // Production: Neon over HTTP. Local development: a plain Postgres on localhost.
    isLocal = host === "localhost" || host === "127.0.0.1";
    instance = isLocal
      ? (drizzlePg(new Pool({ connectionString: url }), { schema }) as unknown as DB)
      : drizzleNeon(neon(url), { schema });
  }
  return instance;
}

/**
 * Connects on first use, not at import time, so `next build` succeeds
 * even before the database env vars exist.
 */
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

type Query = Parameters<DB["batch"]>[0][number];

/**
 * Runs several write statements all-or-nothing.
 * Neon HTTP: one batch = one transaction. Local Postgres: an explicit transaction.
 */
export async function atomic(queries: Query[]) {
  if (queries.length === 0) return;
  const real = getDb();
  if (!isLocal) {
    await real.batch(queries as [Query, ...Query[]]);
    return;
  }
  const pg = real as unknown as { $client: Pool };
  const client = await pg.$client.connect();
  try {
    await client.query("BEGIN");
    for (const q of queries) {
      const { sql, params } = (q as unknown as { toSQL(): { sql: string; params: unknown[] } }).toSQL();
      await client.query(sql, params as unknown[]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export { schema };
