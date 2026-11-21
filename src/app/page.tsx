import Image from "next/image";
import { requireUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-6 sm:p-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/dg-head.svg" alt="" width={40} height={40} />
          <h1 className="text-xl font-semibold">DG Work Hub</h1>
        </div>
        <SignOutButton />
      </header>
      <section className="mt-16 rounded-[var(--radius-card)] border border-line bg-surface p-10">
        <p className="text-muted">Signed in as {user.email}.</p>
        <p className="mt-2 text-sm text-muted">Step 1 is live: login, database and deployment work.</p>
      </section>
    </main>
  );
}
