"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

/**
 * Account self-service actions: logout + GDPR delete (double-confirm).
 * Deletion is final; the server anonymises financial records and removes
 * the account (spec 20/38).
 */
export function AccountActions() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Verwijderen mislukt.");
      setMessage(body?.message ?? "Je account is verwijderd.");
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
        >
          Uitloggen
        </button>
        {!confirming && !message && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-state-error/30 px-4 py-2 text-sm font-medium text-state-error hover:bg-red-50"
          >
            Account verwijderen…
          </button>
        )}
      </div>

      {confirming && !message && (
        <div
          role="alertdialog"
          aria-label="Bevestig accountverwijdering"
          className="rounded-xl border border-state-error/30 bg-red-50 p-4"
        >
          <p className="text-sm font-semibold text-state-error">Weet je het zeker?</p>
          <p className="mt-1 text-xs leading-relaxed text-state-error">
            Je account en persoonsgegevens worden verwijderd. Bestel- en factuurgegevens blijven per
            wetgeving bewaard maar zijn dan geanonimiseerd. Dit kan niet ongedaan worden gemaakt.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy}
              className={cn(
                "rounded-lg bg-state-error px-4 py-2 text-sm font-semibold text-white",
                busy && "opacity-60",
              )}
            >
              {busy ? "Verwijderen…" : "Ja, definitief verwijderen"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink"
            >
              Annuleren
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-state-error">{error}</p>}
        </div>
      )}

      {message && (
        <p role="status" className="text-sm text-brand-800">
          {message}
        </p>
      )}
    </div>
  );
}
