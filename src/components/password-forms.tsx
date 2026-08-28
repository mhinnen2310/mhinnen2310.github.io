"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Password-related client forms:
 * - ForgotPasswordForm: always succeeds (never reveals account existence).
 * - ResetPasswordForm: single-use token from e-mail link.
 * - ChangePasswordForm: for logged-in accounts.
 */

function useBusyError() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return { busy, setBusy, error, setError, ok, setOk };
}

function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  if (kind === "error") {
    return (
      <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
        {children}
      </p>
    );
  }
  return (
    <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
      {children}
    </p>
  );
}

function PrimaryButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={cn(
        "w-full rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800",
        busy && "opacity-70",
      )}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

export function ForgotPasswordForm() {
  const s = useBusyError();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (s.busy) return;
    s.setBusy(true);
    s.setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: String(data.get("email") ?? "") }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      s.setOk(body?.message ?? "Als er een account met dat e-mailadres bestaat, heb je een link ontvangen.");
    } catch {
      s.setError("Er ging iets mis. Probeer het later opnieuw.");
    } finally {
      s.setBusy(false);
    }
  }

  if (s.ok) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{s.ok}</Alert>
        <Link href="/inloggen" className="block text-center text-sm font-medium text-brand-700 underline">
          Naar inloggen
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {s.error && <Alert kind="error">{s.error}</Alert>}
      <div>
        <label htmlFor="fp-email" className="mb-1 block text-sm text-ink-soft">
          E-mailadres
        </label>
        <input
          id="fp-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
      </div>
      <PrimaryButton busy={s.busy} label="Herstelloos versturen" busyLabel="Versturen…" />
      <p className="text-center text-xs text-ink-faint">
        <Link href="/inloggen" className="text-brand-700 underline">
          ← Terug naar inloggen
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const s = useBusyError();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (s.busy) return;
    s.setBusy(true);
    s.setError(null);
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    if (password !== confirm) {
      s.setError("De wachtwoorden zijn niet hetzelfde.");
      s.setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "De herstelcode is ongeldig of verlopen. Vraag een nieuwe link aan.");
      }
      s.setOk("Je wachtwoord is bijgewerkt. Log nu in met je nieuwe wachtwoord.");
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      s.setBusy(false);
    }
  }

  if (s.ok) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{s.ok}</Alert>
        <Link
          href="/inloggen"
          className="block rounded-lg bg-brand-700 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-800"
        >
          Naar inloggen
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {s.error && <Alert kind="error">{s.error}</Alert>}
      <div>
        <label htmlFor="rp-password" className="mb-1 block text-sm text-ink-soft">
          Nieuw wachtwoord
        </label>
        <input
          id="rp-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs text-ink-faint">Minimaal 10 tekens.</p>
      </div>
      <div>
        <label htmlFor="rp-confirm" className="mb-1 block text-sm text-ink-soft">
          Bevestig nieuw wachtwoord
        </label>
        <input
          id="rp-confirm"
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
      </div>
      <PrimaryButton busy={s.busy} label="Wachtwoord bijwerken" busyLabel="Bijwerken…" />
    </form>
  );
}

export function ChangePasswordForm() {
  const s = useBusyError();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (s.busy) return;
    s.setBusy(true);
    s.setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          current: String(data.get("current") ?? ""),
          next: String(data.get("next") ?? ""),
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; field?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Er ging iets mis.");
      }
      s.setOk("Je wachtwoord is gewijzigd.");
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      s.setBusy(false);
    }
  }

  if (s.ok) {
    return <Alert kind="success">{s.ok}</Alert>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {s.error && <Alert kind="error">{s.error}</Alert>}
      <div>
        <label htmlFor="cp-current" className="mb-1 block text-sm text-ink-soft">
          Huidig wachtwoord
        </label>
        <input
          id="cp-current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="cp-next" className="mb-1 block text-sm text-ink-soft">
          Nieuw wachtwoord
        </label>
        <input
          id="cp-next"
          name="next"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs text-ink-faint">Minimaal 10 tekens.</p>
      </div>
      <PrimaryButton busy={s.busy} label="Wachtwoord wijzigen" busyLabel="Wijzigen…" />
    </form>
  );
}
