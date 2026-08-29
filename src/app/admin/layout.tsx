import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/admin-auth";
import { AdminNavigation } from "@/components/admin-navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/inloggen?callbackUrl=%2Fadmin");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Beheer</p>
          <h1 className="text-xl font-bold tracking-tight text-ink">Demi Fietsen</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink">{user.name ?? user.email}</p>
          <p className="text-xs uppercase tracking-wide text-ink-faint">{user.role.toLowerCase()}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-line bg-card lg:sticky lg:top-20 lg:self-start">
          <AdminNavigation />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
