"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const res = await authClient.signIn.social({ provider: "github", callbackURL: "/" });
    if (res?.error) {
      setError("Sign-in failed. This app is private.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="mt-8 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-black transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Redirecting…" : "Continue with GitHub"}
      </button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
