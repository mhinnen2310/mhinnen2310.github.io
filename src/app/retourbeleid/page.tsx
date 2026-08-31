import type { Metadata } from "next";
import Link from "next/link";
import { getLegalPage } from "@/lib/legal";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = { title: "Retour- en garantiebeleid" };

export default async function RetourbeleidPage() {
  const page = await getLegalPage("retourbeleid");
  if (!page) return null;
  return (
    <LegalLayout title={page.title} updatedAt={page.updatedAt}>
      {page.body.split("\n\n").map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <div className="mt-8 rounded-xl border border-line bg-card p-4">
        <p className="text-sm font-medium text-ink">Een retour, garantie- of serviceverzoek indienen?</p>
        <p className="mt-1 text-sm text-ink-soft">
          Gebruik het formulier; we beoordelen elk verzoek per geval en nemen contact met je op.
        </p>
        <Link
          href="/service"
          className="mt-3 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Naar het formulier
        </Link>
      </div>
    </LegalLayout>
  );
}
