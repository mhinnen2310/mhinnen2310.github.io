import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Wachtwoord wijzigen" };

export const dynamic = "force-dynamic";

export default async function AccountWachtwoordPage() {
  const user = await getSessionUser();
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <Link href="/account" className="text-sm text-brand-700 underline">
        ← Naar je account
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">Wachtwoord wijzigen</h1>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
