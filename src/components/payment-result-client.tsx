"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface OrderStatus {
  orderNumber: string;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  fulfilmentStatus: string;
  placedAt: string;
  paidAt: string | null;
}

/**
 * Polls the signed checkout status endpoint until the payment state is final.
 * Server state only — the
 * browser returning to this page never means "paid" (Invariant 9).
 */
export function PaymentResultClient({ orderNumber, statusToken }: { orderNumber: string; statusToken: string }) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [givingUp, setGivingUp] = useState(false);
  const startedAt = useRef(Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/checkout/status?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(statusToken)}`,
        {
        cache: "no-store",
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Status kon niet worden opgehaald.");
      }
      const s = (await res.json()) as OrderStatus;
      setStatus(s);
      if (s.paymentStatus !== "PENDING") return true;
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
      return false;
    }
  }, [orderNumber, statusToken]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function loop() {
      if (cancelled) return;
      const done = await poll();
      if (cancelled || done) return;
      if (Date.now() - startedAt.current > 90_000) {
        setGivingUp(true);
        return;
      }
      timer = setTimeout(loop, 2000);
    }
    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  if (givingUp) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <h1 className="text-lg font-bold text-ink">Nog niet definitief</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          We hebben bestelling <span className="font-semibold text-ink">{orderNumber}</span> binnen, maar
          de betaling is nog niet definitief bevestigd. Check je e-mail: daar staat of de betaling
          door is gegaan. Bij vragen bel of mail ons gerust.
        </p>
        <Link
          href="/fietsen"
          className="mt-5 inline-block rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Terug naar de winkel
        </Link>
      </div>
    );
  }

  if (status?.paymentStatus === "PAID") {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center" role="status">
        <div
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-700"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-brand-900">Betaling geslaagd</h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-800">
          Bedankt! Je bestelling <span className="font-semibold">{status.orderNumber}</span> is
          definitief. Je ontvangt zo een bevestigende e-mail met alle details.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/fietsen"
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Verder kijken
          </Link>
          <Link
            href="/account"
            className="rounded-lg border border-brand-300 bg-card px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-white"
          >
            Naar je account
          </Link>
        </div>
      </div>
    );
  }

  if (status && status.paymentStatus !== "PENDING") {
    const messages: Record<string, string> = {
      FAILED: "De betaling is helaas niet doorgegaan.",
      CANCELLED: "De betaling is geannuleerd.",
      EXPIRED: "De betaling is verlopen.",
      REFUNDED: "Je bestelling is terugbetaald.",
      PARTIALLY_REFUNDED: "Je bestelling is deels terugbetaald.",
    };
    return (
      <div className="rounded-2xl border border-accent-100 bg-accent-50 p-6 text-center" role="status">
        <h1 className="text-xl font-bold tracking-tight text-accent-700">
          {messages[status.paymentStatus] ?? "De betaling is niet geslaagd."}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-accent-700">
          Je bent niets verschuldigd voor bestelling {status.orderNumber}. Probeer het opnieuw of neem
          contact met ons op — we helpen je graag verder.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/winkelwagen"
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Terug naar winkelwagen
          </Link>
          <Link
            href="/contact"
            className="rounded-lg border border-accent-200 bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-white"
          >
            Contact opnemen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-700" aria-hidden />
      <h1 className="mt-3 text-lg font-bold text-ink">We bevestigen je betaling…</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Even geduld — dit duurt meestal maar enkele seconden. Sluit deze pagina niet.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-state-error">
          {error}
        </p>
      )}
    </div>
  );
}
