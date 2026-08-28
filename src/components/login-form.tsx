"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Credentials login (next-auth). Rate limiting lives server-side in the
 * authorize() callback (per e-mail + IP, fixed window).
 */
export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Onjuiste combinatie van e-mail en wachtwoord, of te veel pogingen. Probeer het later opnieuw.");
      setBusy(false);
      return;
    }
    window.location.href = "/account";
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-ink-soft">
          E-mailadres
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-ink-soft">
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <div className="mt-2 text-right">
          <Link href="/wachtwoord-vergeten" className="text-xs font-medium text-brand-700 underline">
            Wachtwoord vergeten?
          </Link>
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className={cn(
          "w-full rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800",
          busy && "opacity-70",
        )}
      >
        {busy ? "Inloggen…" : "Inloggen"}
      </button>
      <p className="text-center text-xs text-ink-faint">
        Nog geen account?{" "}
        <Link href="/account/aanmaken" className="font-medium text-brand-700 underline">
          Maak er een aan
        </Link>
      </p>
    </form>
  );
}
