import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Wachtwoord herstellen" };

export const dynamic = "force-dynamic";

export default async function WachtwoordResettenPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await props.searchParams;
  const token = typeof raw.token === "string" ? raw.token : null;

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Ongeldige link</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Deze herstelloos is onvolledig. Vraag een nieuwe link aan via
          <Link href="/wachtwoord-vergeten" className="underline">
            wachtwoord vergeten
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Nieuw wachtwoord instellen</h1>
      <p className="mt-1 text-sm text-ink-soft">Kies een sterk nieuw wachtwoord (minimaal 10 tekens).</p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
