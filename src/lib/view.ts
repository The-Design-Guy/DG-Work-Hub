import "server-only";
import { cookies } from "next/headers";

export type View = "cards" | "list";

/** Cards or list, remembered per browser. */
export async function getView(): Promise<View> {
  return (await cookies()).get("dg_view")?.value === "list" ? "list" : "cards";
}

const SORTS = ["custom", "az", "za", "modified", "launched"] as const;

/** Sort order, remembered per browser. */
export async function getSort(): Promise<(typeof SORTS)[number]> {
  const v = (await cookies()).get("dg_sort")?.value;
  return (SORTS as readonly string[]).includes(v ?? "") ? (v as (typeof SORTS)[number]) : "custom";
}
