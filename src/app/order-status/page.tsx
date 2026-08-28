import type { Metadata } from "next";
import { OrderLookupForm } from "@/components/order-lookup-form";

export const metadata: Metadata = { title: "Bestelstatus opvragen" };

export const dynamic = "force-dynamic";

export default async function OrderStatusPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const order = typeof raw.order === "string" ? raw.order : undefined;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Bestelstatus opvragen</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Vul je bestelnummer (bijv. DF-2026-000001) en het e-mailadres dat je bij de bestelling hebt
        gebruikt. Je ziet dan de status, de items, de factuur en de garantie.
      </p>
      <div className="mt-6">
        <OrderLookupForm initialOrder={order} />
      </div>
    </div>
  );
}
