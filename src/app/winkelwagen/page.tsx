import type { Metadata } from "next";
import Link from "next/link";
import { getCartToken } from "@/lib/cart-session";
import { getCartByToken, quoteCart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { mediaWidthUrl } from "@/lib/media";
import { CartLineActions } from "@/components/cart-line-actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/badge";
import { getTaxConfig } from "@/lib/tax";

export const metadata: Metadata = { title: "Winkelwagen" };

export const dynamic = "force-dynamic";

/**
 * Cart page (spec 14).
 *
 * Rendered server-side from the authoritative DB state; the client only
 * performs small mutations (quantity/remove) which are re-validated on the
 * server. Prices are read from the DB at render time — never trusted from
 * the browser (Invariant 5).
 */
export default async function WinkelwagenPage() {
  const token = await getCartToken();
  const cart = token ? await getCartByToken(token) : null;
  const quote = cart ? await quoteCart(cart.id).catch(() => null) : null;

  if (!quote || quote.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Winkelwagen</h1>
        <div className="mt-6">
          <EmptyState
            title="Je winkelwagen is leeg"
            hint="Bekijk de actuele fietsen en accessoires — elk uniek exemplaar is klaar om direct te rijden."
            action={
              <Link
                href="/fietsen"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Bekijk beschikbare fietsen
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const taxConfig = await getTaxConfig();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Winkelwagen</h1>

      {!quote.allValid && (
        <div role="alert" className="mt-4 rounded-xl border border-accent-100 bg-accent-50 p-4">
          <p className="text-sm font-semibold text-accent-700">Let op, er is iets niet in orde:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-accent-700">
            {quote.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-accent-700">
            Verwijder de betrokken regel of kies een alternatief voordat je door gaat naar de kassa.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {quote.lines.map((line) => (
          <li key={line.id} className="flex gap-4 rounded-xl border border-line bg-card p-4">
            {line.imageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaWidthUrl(line.imageKey, 256)}
                alt={line.name}
                width={80}
                height={80}
                loading="lazy"
                className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-xs text-ink-faint"
              >
                Foto
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={line.kind === "UNIQUE_BIKE" ? "/fietsen" : "/accessoires"} className="sr-only">
                    Overzicht
                  </Link>
                  <p className="text-sm font-semibold text-ink">{line.name}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {line.identifier && <>Nr. {line.identifier} — </>}
                    {line.kind === "UNIQUE_BIKE" ? "Unieke tweedehands fiets" : "Accessoire"}
                  </p>
                </div>
                <p className="text-sm font-bold text-ink">
                  {line.available ? (
                    formatPrice(line.lineTotalCents)
                  ) : (
                    <Badge tone="red">Niet beschikbaar</Badge>
                  )}
                </p>
              </div>
              {line.issue && (
                <p className="text-xs text-state-error" role="alert">
                  {line.issue}
                </p>
              )}
              <div className="mt-auto">
                <CartLineActions
                  lineId={line.id}
                  kind={line.kind}
                  quantity={line.quantity}
                  stockQuantity={99}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-line bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Subtotaal</span>
          <span className="font-semibold text-ink">{formatPrice(quote.subtotalCents)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          {taxConfig.basis === "incl" && taxConfig.bikeScheme === "MARGIN"
            ? "Fietsen kunnen onder de margeregeling vallen; verzending en het definitieve totaal worden bij de kassa berekend."
            : "Verzending en eventuele btw worden bij de kassa berekend op basis van je keuze."}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/fietsen"
            className="text-sm font-medium text-brand-700 underline hover:text-brand-800"
          >
            ← Verder winkelen
          </Link>
          {quote.allValid ? (
            <Link
              href="/checkout"
              className="rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Door naar kassa
            </Link>
          ) : (
            <span className="rounded-lg bg-ink/10 px-6 py-3 text-sm font-semibold text-ink-faint">
              Eerst winkelwagen aanpassen
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-faint">
        <p className="font-medium text-ink-soft">Goed om te weten</p>
        <p className="mt-1">
          Elke tweedehands fiets is een uniek exemplaar. Zodra je de kassa bereikt, leggen we de fiets
          voor jou vast zodat niemand anders hem tegelijk kan kopen. De definitieve prijzen worden
          server-side geverifieerd.
        </p>
      </div>
    </div>
  );
}
