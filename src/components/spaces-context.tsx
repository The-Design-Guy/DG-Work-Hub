"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SpaceView } from "@/lib/types";

const Ctx = createContext<SpaceView[]>([]);

/** Makes the Home tabs available to cards and dialogs anywhere in the app. */
export function SpacesProvider({ spaces, children }: { spaces: SpaceView[]; children: ReactNode }) {
  return <Ctx.Provider value={spaces}>{children}</Ctx.Provider>;
}

export const useSpaces = () => useContext(Ctx);
