import type { Metadata } from "next";
import { MockPaymentClient } from "@/components/mock-payment-client";

export const metadata: Metadata = { title: "Betaling (testomgeving)" };

export const dynamic = "force-dynamic";

/**
 * Mock payment page — development & E2E only.
 *
 * Simulates the provider's checkout page: buttons fire the same webhook
 * endpoint a real provider would call (/api/webhooks/mock), so the entire
 * order -> payment -> webhook -> sold pipeline is exercised exactly as in
 * production. The endpoint itself refuses to run in production.
 */
export default async function MockPaymentPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const payment = typeof raw.payment === "string" ? raw.payment : null;
  const order = typeof raw.order === "string" ? raw.order : null;
  const token = typeof raw.token === "string" ? raw.token : null;

  if (!payment || !order || !token) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">Ontbrekende betalingsgegevens</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Deze pagina is alleen bereikbaar vanuit een lopende testbestelling.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <MockPaymentClient paymentId={payment} orderNumber={order} statusToken={token} />
    </div>
  );
}
