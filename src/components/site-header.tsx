import Link from "next/link";
import { Suspense } from "react";
import type { SettingsView } from "@/lib/settings";
import { mediaWidthUrl } from "@/lib/media";
import { CartCountButton } from "./cart-count";
import { SearchLink } from "./search-link";

const NAV = [
  { href: "/fietsen", label: "Fietsen" },
  { href: "/accessoires", label: "Accessoires" },
  { href: "/afspraak", label: "Proefrit / afspraak" },
  { href: "/over-ons", label: "Over ons" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ settings, showAdmin = false }: { settings: SettingsView; showAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 rounded" aria-label={`${settings.companyName} — home`}>
          {settings.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaWidthUrl(settings.logoKey, 400)} alt="" className="h-9 w-auto" />
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white"
            >
              DF
            </span>
          )}
          <span className="hidden text-lg font-semibold tracking-tight text-ink sm:block">
            {settings.companyName}
          </span>
        </Link>

        <nav aria-label="Hoofdmenu" className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Suspense fallback={null}>
            <SearchLink />
          </Suspense>
          <CartCountButton />
          <Link
            href="/account"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-800 sm:block"
          >
            Account
          </Link>
          {showAdmin && (
            <Link href="/admin" className="hidden rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 sm:block">
              Beheer
            </Link>
          )}
          <MobileMenu showAdmin={showAdmin} />
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ showAdmin }: { showAdmin: boolean }) {
  return (
    <details className="relative lg:hidden">
      <summary
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-ink-soft hover:bg-brand-50"
        aria-label="Menu openen"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <nav
        aria-label="Mobiel menu"
        className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-line bg-card p-2 shadow-pop"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink hover:bg-brand-50"
          >
            {n.label}
          </Link>
        ))}
        <Link
          href="/account"
          className="mt-1 block rounded-md border-t border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-brand-50"
        >
          Account
        </Link>
        {showAdmin && (
          <Link href="/admin" className="mt-1 block rounded-md bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Beheer openen
          </Link>
        )}
      </nav>
    </details>
  );
}
