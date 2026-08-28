import type { Metadata } from "next";
import Link from "next/link";
import { getCartToken } from "@/lib/cart-session";
import { quoteCheckout } from "@/lib/checkout-quote";
import { formatPrice } from "@/lib/utils";
import { CheckoutForm } from "@/components/checkout-form";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Kassa" };

export const dynamic = "force-dynamic";

/**
 * Checkout (spec 15).
 *
 * The quote (lines, delivery options, totals, tax note) is computed
 * server-side from DB state. The form collects customer data + delivery
 * choice and posts to /api/checkout/start, which re-validates everything
 * and atomically reserves unique bikes before creating the payment.
 */
export default async function CheckoutPage() {
  const token = await getCartToken();
  const quote = token ? await quoteCheckout(token).catch(() => null) : null;

  if (!quote) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Kassa</h1>
        <div className="mt-6">
          <EmptyState
            title="Er is niets in je winkelwagen"
            hint="Voeg eerst een fiets of accessoires toe voordat je door gaat naar de kassa."
            action={
              <Link
                href="/fietsen"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Naar het assortiment
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (!quote.allValid) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Kassa</h1>
        <div role="alert" className="mt-6 rounded-xl border border-accent-100 bg-accent-50 p-5">
          <p className="text-sm font-semibold text-accent-700">We kunnen je winkelwagen niet afhandelen:</p>
          <ul className="mt-2 list-inside list-disc text-sm text-accent-700">
            {quote.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
        <Link
          href="/winkelwagen"
          className="mt-6 inline-block rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Terug naar winkelwagen
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Kassa</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {quote.lines.length} {quote.lines.length === 1 ? "artikel" : "artikelen"} · totaal{" "}
        <span className="font-semibold text-ink">{formatPrice(quote.totalCents)}</span>
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <CheckoutForm
          deliveryOptions={quote.deliveryOptions}
          defaultMethodId={quote.defaultMethodId}
          totalCents={quote.totalCents}
          subtotalCents={quote.subtotalCents}
          taxNote={quote.taxNote}
        />

        <aside aria-label="Bestelling" className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-card p-5">
            <h2 className="text-sm font-semibold text-ink">Je bestelling</h2>
            <ul className="mt-3 space-y-3">
              {quote.lines.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-ink-soft">
                    {l.quantity > 1 && (
                      <span className="mr-1 rounded bg-surface px-1.5 py-0.5 text-xs text-ink-faint">
                        ×{l.quantity}
                      </span>
                    )}
                    {l.name}
                    {l.identifier && <span className="block text-xs text-ink-faint">Nr. {l.identifier}</span>}
                  </span>
                  <span className="shrink-0 font-medium text-ink">{formatPrice(l.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotaal</span>
                <span>{formatPrice(quote.subtotalCents)}</span>
              </div>
              <div className="flex justify-between font-semibold text-ink">
                <span>Totaal</span>
                <span>{formatPrice(quote.totalCents)}</span>
              </div>
              <p className="pt-1 text-xs text-ink-faint">{quote.taxNote}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-faint">
            <p className="font-medium text-ink-soft">Veilig bestellen</p>
            <p className="mt-1">
              We verwerken betalingen via onze betaalprovider. Kaartgegevens worden door jou rechtstreeks
              aan de provider verstrekt en niet door ons opgeslagen.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
