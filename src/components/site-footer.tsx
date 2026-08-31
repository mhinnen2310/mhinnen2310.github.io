import Link from "next/link";
import type { SettingsView } from "@/lib/settings";

export function SiteFooter({ settings }: { settings: SettingsView }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-line bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-semibold text-white">{settings.companyName}</p>
          <p className="mt-2 text-sm leading-relaxed text-brand-200">
            Tweedehands elektrische fietsen, geïnspecteerd en gereviseerd. Elke fiets is een uniek
            exemplaar.
          </p>
          {settings.socialLinks.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Social media">
              {settings.socialLinks.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-brand-800 px-3 py-1.5 text-xs font-medium text-brand-100 hover:bg-brand-900"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="Footer navigatie">
          <p className="text-sm font-semibold text-white">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white hover:underline" href="/fietsen">Beschikbare fietsen</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/verkocht">Verkochte fietsen</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/accessoires">Accessoires</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/afspraak">Proefrit / afspraak</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/winkelwagen">Winkelwagen</Link></li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-white">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            {settings.phone && <li><a className="hover:text-white hover:underline" href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a></li>}
            {settings.email && <li><a className="hover:text-white hover:underline" href={`mailto:${settings.email}`}>{settings.email}</a></li>}
            {settings.addressLine && <li>{settings.addressLine}</li>}
            {(settings.postcode || settings.city) && (
              <li>{[settings.postcode, settings.city].filter(Boolean).join(" ")}</li>
            )}
            {settings.openingHours.map((o) => (
              <li key={o.days} className="text-brand-200">
                {o.days}: {o.hours}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Bedrijf</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white hover:underline" href="/over-ons">Over ons</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/service">Retour, garantie & service</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/nieuwsbrief">Nieuwsbrief</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/privacy">Privacy</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/algemene-voorwaarden">Algemene voorwaarden</Link></li>
            <li><Link className="hover:text-white hover:underline" href="/retourbeleid">Retourbeleid</Link></li>
            {settings.kvkNumber && <li className="text-brand-200">KvK {settings.kvkNumber}</li>}
            {settings.vatId && <li className="text-brand-200">{settings.vatId}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-900">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-brand-300">
          © {year} {settings.companyName}. Alle prijzen zijn vraagprijzen in euro.
        </p>
      </div>
    </footer>
  );
}
