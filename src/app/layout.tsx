import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { Announcement } from "@/components/announcement";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { env } from "@/lib/env";
import { getStaffUser } from "@/lib/admin-auth";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.seo.description;
  return {
    metadataBase: new URL(env.siteUrl),
    title: {
      default: `${s.companyName} — Tweedehands elektrische fietsen met garantie`,
      template: `%s | ${s.companyName}`,
    },
    description,
    openGraph: {
      siteName: s.seo.siteName,
      description,
      locale: "nl_NL",
      type: "website",
    },
    robots: env.isPreview ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f6f3",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, staffUser] = await Promise.all([getSettings(), getStaffUser()]);
  return (
    <html lang="nl">
      <body className="flex min-h-screen flex-col">
        <a
          href="#hoofdinhoud"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
        >
          Naar de inhoud
        </a>
        <Announcement settings={settings} />
        <SiteHeader settings={settings} showAdmin={Boolean(staffUser)} />
        <main id="hoofdinhoud" className="flex-1">
          {children}
        </main>
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
