import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/admin-auth";
import { AdminNavigation } from "@/components/admin-navigation";
import { RedesignAdminNavigation } from "@/components/redesign-admin-navigation";
import { getUiMode } from "@/lib/ui-mode";
import { roleAtLeast } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, uiMode] = await Promise.all([getStaffUser(), getUiMode()]);
  if (!user) redirect("/inloggen?callbackUrl=%2Fadmin");
  const redesigned = uiMode === "redesign";

  return (
    <div className={`mx-auto w-full max-w-7xl px-4 py-6 sm:py-8 ${redesigned ? "redesign-admin-frame" : ""}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 ${redesigned ? "redesign-admin-topbar" : ""}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{redesigned ? "Werkdag" : "Beheer"}</p>
          <h1 className="text-xl font-bold tracking-tight text-ink">Demi Fietsen</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink">{user.name ?? user.email}</p>
          <p className="text-xs uppercase tracking-wide text-ink-faint">{redesigned ? "Vandaag rustig werken · " : ""}{user.role.toLowerCase()}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className={`rounded-xl border border-line bg-card lg:sticky lg:top-20 lg:self-start ${redesigned ? "redesign-admin-aside" : ""}`}>
          {redesigned ? <RedesignAdminNavigation isOwner={roleAtLeast(user.role, "OWNER")} /> : <AdminNavigation isOwner={roleAtLeast(user.role, "OWNER")} />}
        </aside>
        <div className={`min-w-0 ${redesigned ? "redesign-admin-content" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
