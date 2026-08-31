import Link from "next/link";
import type { SettingsView } from "@/lib/settings";

export function RedesignSiteFooter({ settings }: { settings: SettingsView }) {
  return (
    <footer className="redesign-site-footer">
      <div className="redesign-footer-grid">
        <div>
          <p className="redesign-footer-title">{settings.companyName}</p>
          <p>Unieke tweedehands e-bikes, persoonlijk gecontroleerd en met duidelijke garantie.</p>
          {settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
          {settings.phone && <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a>}
        </div>
        <nav aria-label="Shop">
          <p className="redesign-footer-heading">Shop</p>
          <Link href="/fietsen">Beschikbare fietsen</Link>
          <Link href="/verkocht">Verkochte fietsen</Link>
          <Link href="/accessoires">Accessoires</Link>
          <Link href="/afspraak">Proefrit plannen</Link>
          <Link href="/winkelwagen">Winkelwagen</Link>
        </nav>
        <nav aria-label="Informatie">
          <p className="redesign-footer-heading">Informatie</p>
          <Link href="/over-ons">Over ons</Link>
          <Link href="/service">Service</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/nieuwsbrief">Nieuwsbrief</Link>
          <Link href="/retourbeleid">Retourbeleid</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/algemene-voorwaarden">Algemene voorwaarden</Link>
        </nav>
        <div>
          <p className="redesign-footer-heading">Demi Fietsen</p>
          <p>De website gebruikt dezelfde voorraad, bestellingen, afspraken en accounts.</p>
        </div>
      </div>
      <div className="redesign-footer-bottom">
        <span>© {new Date().getFullYear()} {settings.companyName}</span>
        <span>Lokale, rustige bediening</span>
      </div>
    </footer>
  );
}
