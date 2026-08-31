"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard", short: "⌂" },
  { href: "/admin/fietsen", label: "Fietsen", short: "F" },
  { href: "/admin/accu", label: "Accu’s", short: "⚡" },
  { href: "/admin/qr-labels", label: "QR-labels", short: "QR" },
  { href: "/admin/accessoires", label: "Accessoires", short: "A" },
  { href: "/admin/bestellingen", label: "Bestellingen", short: "B" },
  { href: "/admin/reserveringen", label: "Reserveringen", short: "R" },
  { href: "/admin/actie-vereist", label: "Actie vereist", short: "!" },
  { href: "/admin/betalingen-controleren", label: "Betaalreview", short: "€" },
  { href: "/admin/afspraken", label: "Afspraken", short: "P" },
  { href: "/admin/service", label: "Service", short: "S" },
  { href: "/admin/berichten", label: "Berichten", short: "M" },
  { href: "/admin/klanten", label: "Klantdossiers", short: "K" },
  { href: "/admin/gebruikers", label: "Gebruikers & rollen", short: "U" },
  { href: "/admin/instellingen", label: "Instellingen", short: "⚙" },
] as const;

export function AdminNavigation({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Beheermenu" className="flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-visible lg:p-3">
      {ADMIN_LINKS.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-700 text-white" : "text-ink-soft hover:bg-brand-50 hover:text-brand-800",
            )}
          >
            <span aria-hidden className={cn("flex h-6 w-6 items-center justify-center rounded text-xs font-bold", active ? "bg-white/15" : "bg-surface")}>
              {item.short}
            </span>
            {item.label}
          </Link>
        );
      })}
      {isOwner && (
        <Link
          href="/admin/administratie"
          aria-current={pathname.startsWith("/admin/administratie") ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/admin/administratie") ? "bg-brand-700 text-white" : "text-ink-soft hover:bg-brand-50 hover:text-brand-800",
          )}
        >
          <span aria-hidden className={cn("flex h-6 w-6 items-center justify-center rounded text-xs font-bold", pathname.startsWith("/admin/administratie") ? "bg-white/15" : "bg-surface")}>PDF</span>
          Administratie
        </Link>
      )}
    </nav>
  );
}
