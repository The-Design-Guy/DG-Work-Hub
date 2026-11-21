import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Server-side gate. Every page, action and route that touches data calls this. */
export async function requireUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/login");
  return s.user;
}

export async function getOptionalUser() {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user ?? null;
}
