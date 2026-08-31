import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Account aanmaken" };

export default function AccountAanmakenPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Account aanmaken</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Handig om je bestellingen, garantie en serviceverzoeken bij de hand te houden. Je kunt ook
        gewoon zonder account bestellen.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6">
        <RegisterForm />
      </div>
    </div>
  );
}
