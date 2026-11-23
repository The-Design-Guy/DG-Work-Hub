import "server-only";
import { cookies } from "next/headers";

export type View = "cards" | "list";

/** Cards or list, remembered per browser. */
export async function getView(): Promise<View> {
  return (await cookies()).get("dg_view")?.value === "list" ? "list" : "cards";
}
