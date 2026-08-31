import Link from "next/link";
import type { SettingsView } from "@/lib/settings";
import { mediaWidthUrl } from "@/lib/media";
import { CartCountButton } from "./cart-count";
import { SearchLink } from "./search-link";

const NAV = [
  { href: "/fietsen", label: "Fietsen" },
  { href: "/accessoires", label: "Accessoires" },
  { href: "/afspraak", label: "Proefrit" },
  { href: "/service", label: "Service" },
  { href: "/over-ons", label: "Over ons" },
];

export function RedesignSiteHeader({ settings, showAdmin = false }: { settings: SettingsView; showAdmin?: boolean }) {
  return (
    <header className="redesign-site-header">
      <div className="redesign-header-inner">
        <Link href="/" className="redesign-brand" aria-label={`${settings.companyName} — home`}>
          {settings.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaWidthUrl(settings.logoKey, 400)} alt="" className="redesign-brand-logo" />
          ) : (
            <span aria-hidden className="redesign-brand-mark">DF</span>
          )}
          <span className="redesign-brand-copy">
            <strong>{settings.companyName}</strong>
            <small>rust in je werkdag</small>
          </span>
        </Link>

        <nav aria-label="Hoofdmenu" className="redesign-main-nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>

        <div className="redesign-header-tools">
          <SearchLink />
          <CartCountButton />
          <Link href="/account" className="redesign-tool-link">Account</Link>
          {showAdmin && <Link href="/admin" className="redesign-admin-link">Beheer</Link>}
          <details className="redesign-mobile-menu">
            <summary aria-label="Menu openen">Menu</summary>
            <nav aria-label="Mobiel menu">
              {NAV.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
              <Link href="/contact">Contact</Link>
              <Link href="/account">Account</Link>
              {showAdmin && <Link href="/admin">Beheer openen</Link>}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
