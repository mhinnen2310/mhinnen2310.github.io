import type { Metadata } from "next";
import Link from "next/link";
import { PaymentResultClient } from "@/components/payment-result-client";

export const metadata: Metadata = { title: "Betaling" };

export const dynamic = "force-dynamic";

/**
 * Payment result page (spec 13).
 *
 * The browser NEVER determines payment state: this page polls
 * /api/checkout/status (keyed by the order number) until the order's
 * paymentStatus leaves PENDING. Only verified provider state (webhook)
 * moves that field (Invariant 9).
 */
export default async function PaymentResultPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const order = typeof raw.order === "string" ? raw.order : null;
  const token = typeof raw.token === "string" ? raw.token : null;

  if (!order || !token) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">Ongeldige betalingslink</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Je kunt gewoon doorgaan met winkelen.
        </p>
        <Link
          href="/fietsen"
          className="mt-5 inline-block rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Naar het assortiment
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
        <PaymentResultClient orderNumber={order} statusToken={token} />
    </div>
  );
}
