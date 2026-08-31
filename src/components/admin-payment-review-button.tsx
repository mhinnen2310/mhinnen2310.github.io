"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminPaymentReviewButton({ paymentId }: { paymentId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function retry() { if (!window.confirm("Opnieuw verwerken gebruikt uitsluitend de bestaande, provider-geverifieerde betaling. Doorgaan?")) return; setBusy(true); setMessage(null); try { const response = await fetch(`/api/admin/payments/${paymentId}/review`, { method: "POST" }); const body = await response.json().catch(() => null) as { error?: string; result?: { outcome?: string } } | null; if (!response.ok) { setMessage(body?.error ?? "Verwerken mislukt."); return; } setMessage(body?.result?.outcome === "completed" ? "Verkoop is veilig afgerond." : "Geen automatische afronding mogelijk; controleer de order en voorraad."); router.refresh(); } catch { setMessage("De verbinding is mislukt."); } finally { setBusy(false); } }
  return <div><button onClick={retry} disabled={busy} className="rounded border border-brand-700 px-2 py-1 text-xs font-semibold text-brand-800 disabled:opacity-50">{busy ? "Verwerken…" : "Opnieuw veilig verwerken"}</button>{message && <p className="mt-1 text-xs text-ink-soft">{message}</p>}</div>;
}
