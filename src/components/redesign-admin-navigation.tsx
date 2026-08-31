"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Vandaag",
    links: [
      { href: "/admin", label: "Dashboard", short: "⌂" },
      { href: "/admin/actie-vereist", label: "Actie vereist", short: "!" },
    ],
  },
  {
    label: "Voorraad",
    links: [
      { href: "/admin/fietsen", label: "Fietsen & intake", short: "F" },
      { href: "/admin/accu", label: "Accu’s", short: "⚡" },
      { href: "/admin/accessoires", label: "Accessoires", short: "A" },
      { href: "/admin/qr-labels", label: "QR-labels", short: "QR" },
    ],
  },
  {
    label: "Verkoop",
    links: [
      { href: "/admin/bestellingen", label: "Bestellingen", short: "B" },
      { href: "/admin/reserveringen", label: "Reserveringen", short: "R" },
      { href: "/admin/betalingen-controleren", label: "Betaalreview", short: "€" },
    ],
  },
  {
    label: "Relaties & planning",
    links: [
      { href: "/admin/afspraken", label: "Gedeelde agenda", short: "A" },
      { href: "/admin/service", label: "Service & werkplaats", short: "S" },
      { href: "/admin/klanten", label: "Klantdossiers", short: "K" },
      { href: "/admin/berichten", label: "Berichten", short: "M" },
    ],
  },
  {
    label: "Beheer",
    links: [
      { href: "/admin/gebruikers", label: "Gebruikers & rollen", short: "U" },
      { href: "/admin/instellingen", label: "Instellingen", short: "⚙" },
    ],
  },
] as const;

export function RedesignAdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Nieuw beheermenu" className="redesign-admin-nav">
      {GROUPS.map((group) => (
        <div key={group.label} className="redesign-admin-group">
          <p>{group.label}</p>
          {group.links.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("redesign-admin-nav-link", active && "is-active")}
              >
                <span aria-hidden>{item.short}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
      <Link href="/?ui=classic" className="redesign-admin-classic-link">Klassieke site</Link>
    </nav>
  );
}
