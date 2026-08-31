"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface CheckoutFormProps {
  deliveryOptions: {
    id: string;
    label: string;
    costCents: number;
    requiresAddress: boolean;
    applicable: boolean;
    error: string | null;
    instructions: string | null;
  }[];
  defaultMethodId: string | null;
  totalCents: number;
  subtotalCents: number;
  taxNote: string;
}

interface StartResult {
  orderNumber?: string;
  statusToken?: string;
  paymentUrl?: string | null;
  error?: string;
}

/**
 * Checkout form (spec 15).
 *
 * The client only collects customer data + delivery choice. All prices are
 * computed server-side (Invariant 5) and the order is created by
 * /api/checkout/start, which atomically reserves any unique bike
 * (Invariant 3) before a payment is created.
 */
export function CheckoutForm(props: CheckoutFormProps) {
  const [method, setMethod] = useState<string>(props.defaultMethodId ?? "");
  const [billingDiffers, setBillingDiffers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = props.deliveryOptions.find((o) => o.id === method);
  const needsAddress = selected?.requiresAddress ?? false;
  const defaultDelivery = props.deliveryOptions.find((o) => o.id === props.defaultMethodId);
  const displayedTotal =
    props.totalCents - (defaultDelivery?.costCents ?? 0) + (selected?.applicable ? selected.costCents : 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const text = (k: string) => (typeof data.get(k) === "string" ? (data.get(k) as string).trim() : "");

    const address = {
      line1: text("delivery_line1"),
      line2: text("delivery_line2"),
      city: text("delivery_city"),
      postcode: text("delivery_postcode"),
      country: "NL",
    };
    const billing = billingDiffers
      ? {
          line1: text("billing_line1"),
          line2: text("billing_line2"),
          city: text("billing_city"),
          postcode: text("billing_postcode"),
          country: "NL",
        }
      : address;

    const payload = {
      customer: {
        name: text("name"),
        email: text("email"),
        phone: text("phone") || null,
        company: text("company") || null,
      },
      billing,
      delivery: { methodId: method, ...address },
    };

    try {
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await res.json().catch(() => null)) as StartResult | null;
      if (!res.ok || !result?.orderNumber || !result.statusToken) {
        throw new Error(result?.error ?? "De bestelling kon niet worden verwerkt. Probeer het opnieuw.");
      }
      // Server tells us where to pay. Never trust a client-side "success"
      // assumption — the result page polls the authoritative order status.
      window.location.href = result.paymentUrl
        ? result.paymentUrl
        : `/betaaling/resultaat?order=${encodeURIComponent(result.orderNumber)}&token=${encodeURIComponent(result.statusToken)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-busy={busy}>
      {error && (
        <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      {/* Customer */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Jouw gegevens</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Naam" autoComplete="name" required />
          <Field name="email" label="E-mailadres" type="email" autoComplete="email" required />
          <Field name="phone" label="Telefoon (optioneel)" type="tel" autoComplete="tel" />
          <Field name="company" label="Bedrijfsnaam (optioneel)" autoComplete="organization" />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Je hoeft géén account aan te maken om te bestellen. Een account is handig voor bestelgeschiedenis
          en garantieoverzicht.
        </p>
      </fieldset>

      {/* Delivery method */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Levering</legend>
        <div className="mt-3 space-y-2">
          {props.deliveryOptions.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3.5",
                method === o.id ? "border-brand-600 bg-brand-50" : "border-line bg-card",
                !o.applicable && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="delivery_method"
                  value={o.id}
                  checked={method === o.id}
                  onChange={() => setMethod(o.id)}
                  disabled={!o.applicable}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{o.label}</span>
                  {o.applicable ? (
                    o.instructions && <span className="block text-xs text-ink-soft">{o.instructions}</span>
                  ) : (
                    o.error && <span className="block text-xs text-ink-faint">{o.error}</span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink">
                {o.applicable ? (o.costCents === 0 ? "Gratis" : `€ ${(o.costCents / 100).toFixed(2)}`) : "—"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Delivery address */}
      {needsAddress && (
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Leveradres</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field name="delivery_line1" label="Straat + huisnummer" autoComplete="address-line1" required />
            </div>
            <div className="sm:col-span-2">
              <Field name="delivery_line2" label="Toevoeging (optioneel)" autoComplete="address-line2" />
            </div>
            <Field name="delivery_postcode" label="Postcode" autoComplete="postal-code" required />
            <Field name="delivery_city" label="Plaats" autoComplete="address-level2" required />
          </div>
        </fieldset>
      )}

      {/* Billing */}
      <fieldset>
        <legend className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={billingDiffers}
            onChange={(e) => setBillingDiffers(e.target.checked)}
            className="rounded border-line"
          />
          Factuuradres is anders
        </legend>
        {billingDiffers && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field name="billing_line1" label="Straat + huisnummer" autoComplete="off" required />
            </div>
            <div className="sm:col-span-2">
              <Field name="billing_line2" label="Toevoeging (optioneel)" />
            </div>
            <Field name="billing_postcode" label="Postcode" required />
            <Field name="billing_city" label="Plaats" required />
          </div>
        )}
      </fieldset>

      {/* Totals */}
      <div className="rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">Subtotaal</span>
          <span className="font-medium text-ink">€ {(props.subtotalCents / 100).toFixed(2)}</span>
        </div>
        {selected && selected.applicable && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-ink-soft">Levering</span>
            <span className="font-medium text-ink">
              {selected.costCents === 0 ? "Gratis" : `€ ${(selected.costCents / 100).toFixed(2)}`}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="font-semibold text-ink">Totaal</span>
          <span className="text-lg font-bold text-ink">€ {(displayedTotal / 100).toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-faint">{props.taxNote}</p>
      </div>

      <button
        type="submit"
        disabled={busy || !method}
        className="w-full rounded-lg bg-brand-700 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-default disabled:opacity-60"
      >
        {busy ? "Bestelling plaatsen…" : "Bestelling plaatsen & betalen"}
      </button>
      <p className="text-center text-xs text-ink-faint">
        Met klikken ga je akkoord met de voorwaarden. Elke fiets is uniek en wordt direct voor je
        gereserveerd zodra de bestelling wordt verwerkt.
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-ink-soft">
        {label}
        {required && (
          <span className="text-state-error" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm placeholder:text-ink-faint"
      />
    </div>
  );
}
