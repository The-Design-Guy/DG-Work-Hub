import Image from "next/image";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/session";
import { SignInButton } from "./sign-in-button";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getOptionalUser()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-10 text-center">
        <Image
          src="/brand/dg-head.svg"
          alt="The Design Guy"
          width={112}
          height={112}
          priority
          className="mx-auto"
        />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">DG Work Hub</h1>
        <p className="mt-2 text-sm text-muted">Private. Sign in to open your bookmarks.</p>
        <SignInButton />
      </div>
    </main>
  );
}
