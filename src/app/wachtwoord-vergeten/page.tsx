import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function WachtwoordVergetenPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Wachtwoord vergeten</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Vul je e-mailadres in; we sturen een link waarmee je een nieuw wachtwoord kunt instellen.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
