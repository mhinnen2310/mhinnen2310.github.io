"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-state-error">
      {message}
    </p>
  );
}

/**
 * Account registration (spec 15/20).
 *
 * Account is OPTIONAL for buying; this exists for order history, warranty
 * overview and service requests. Server-side validation + argon2id hashing;
 * verification e-mail is best effort (not a purchase blocker).
 */
export function RegisterForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        field?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        if (body?.field) setFieldErrors({ [body.field]: body.error ?? "Ongeldige invoer." });
        else setError(body?.error ?? "Er ging iets mis. Probeer het opnieuw.");
        return;
      }
      // Registration succeeded: send to login (e-mail verification is
      // optional and does not block anything).
      window.location.href = "/inloggen?account=nieuw";
    } catch {
      setError("Er ging iets mis met de verbinding. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="reg-name" className="mb-1 block text-sm text-ink-soft">
          Naam
        </label>
        <input
          id="reg-name"
          name="name"
          required
          autoComplete="name"
          aria-describedby={fieldErrors.name ? "reg-name-error" : undefined}
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <FieldError id="reg-name" message={fieldErrors.name ?? null} />
      </div>
      <div>
        <label htmlFor="reg-email" className="mb-1 block text-sm text-ink-soft">
          E-mailadres
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby={fieldErrors.email ? "reg-email-error" : undefined}
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <FieldError id="reg-email" message={fieldErrors.email ?? null} />
      </div>
      <div>
        <label htmlFor="reg-password" className="mb-1 block text-sm text-ink-soft">
          Wachtwoord
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          aria-describedby={fieldErrors.password ? "reg-password-error" : "reg-password-hint"}
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <FieldError id="reg-password" message={fieldErrors.password ?? null} />
        <p id="reg-password-hint" className="mt-1 text-xs text-ink-faint">
          Minimaal 10 tekens.
        </p>
      </div>
      <button
        type="submit"
        disabled={busy}
        className={cn(
          "w-full rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800",
          busy && "opacity-70",
        )}
      >
        {busy ? "Account aanmaken…" : "Account aanmaken"}
      </button>
      <p className="text-center text-xs text-ink-faint">
        Heb je al een account?{" "}
        <Link href="/inloggen" className="font-medium text-brand-700 underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
