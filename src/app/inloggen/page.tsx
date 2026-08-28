import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Inloggen" };

export default async function InloggenPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const verified = raw.verified === "1";
  const verificationFailed = raw.verified === "0";
  const accountCreated = raw.account === "nieuw";

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Inloggen</h1>
      <p className="mt-1 text-sm text-ink-soft">Je account bij Demi Fietsen.</p>
      {verified && (
        <p role="status" className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Je e-mailadres is bevestigd. Je kunt nu inloggen.
        </p>
      )}
      {verificationFailed && (
        <p role="alert" className="mt-4 rounded-lg border border-state-error/30 bg-red-50 px-4 py-3 text-sm text-state-error">
          Deze bevestigingslink is ongeldig of verlopen.
        </p>
      )}
      {accountCreated && (
        <p role="status" className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Je account is aangemaakt. Controleer je e-mail om je adres te bevestigen.
        </p>
      )}
      <div className="mt-6 rounded-2xl border border-line bg-card p-6">
        <LoginForm />
      </div>
    </div>
  );
}
