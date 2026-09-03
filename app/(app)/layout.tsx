import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:pb-10 min-h-[calc(100vh-64px)]">
        {children}
      </main>
    </AppShell>
  );
}
