"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
      }}
      className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:border-accent hover:text-text"
    >
      Sign out
    </button>
  );
}
