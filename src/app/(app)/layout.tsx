import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { authOptions } from "@/lib/auth-options";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-8 pt-4 sm:px-6">
      <header className="mb-5 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <Link href="/dashboard" className="text-lg font-semibold text-zinc-900">
            Evensplit
          </Link>
          <p className="text-xs text-zinc-500">Logged in as {session.user.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
