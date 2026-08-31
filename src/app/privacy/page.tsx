import type { Metadata } from "next";
import { getLegalPage } from "@/lib/legal";
import { LegalLayout } from "@/components/legal-layout";

export const metadata: Metadata = { title: "Privacyverklaring" };

export default async function PrivacyPage() {
  const page = await getLegalPage("privacy");
  if (!page) return null;
  return (
    <LegalLayout title={page.title} updatedAt={page.updatedAt}>
      {page.body.split("\n\n").map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </LegalLayout>
  );
}
