import { Toaster } from "sonner";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/top-bar";
import { pinnedLinks } from "@/lib/pinned";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <>
      <TopBar user={{ name: user.name, email: user.email, image: user.image }} pinned={pinnedLinks} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-8 sm:px-8">{children}</main>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "!bg-elevated !border-line !text-text !rounded-xl !font-sans",
          },
        }}
      />
    </>
  );
}
