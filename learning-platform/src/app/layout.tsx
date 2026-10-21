import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/lib/providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd, organizationJsonLd, webSiteJsonLd } from "@/components/JsonLd";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://teknest.fr"),
  title: {
    default: "Tech Nest — Réussir le BTS Audiovisuel option Métiers du Son",
    template: "%s · Tech Nest",
  },
  description:
    "Cours gratuits, quiz, examens blancs et annales officielles pour réviser le BTS Métiers de l'audiovisuel, option Métiers du son : E3 PTES, acoustique, audionumérique. Conforme au référentiel officiel (arrêté du 4 juin 2013, RNCP37196).",
  keywords: [
    "BTS audiovisuel son annales",
    "E3 PTES révision",
    "BTS métiers du son",
    "annales BTS audiovisuel option son",
    "BTS MAV son",
    "réviser E3 PTES",
    "physique et technique des équipements et supports",
    "acoustique BTS",
    "audionumérique BTS",
  ],
  alternates: {
    // Resolves per-route against metadataBase → every page gets its own
    // canonical on the production domain.
    canonical: "./",
  },
  openGraph: {
    title: "Tech Nest — Réussir le BTS Audiovisuel option Métiers du Son",
    description:
      "La plateforme de préparation dédiée à l'option Métiers du son : cours alignés sur le référentiel officiel, annales E3 PTES 2017-2025, certificats de compétences RNCP.",
    locale: "fr_FR",
    type: "website",
    siteName: "Tech Nest",
    url: "https://teknest.fr",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech Nest — Réussir le BTS Audiovisuel option Métiers du Son",
    description:
      "Cours gratuits, annales officielles E3 PTES et examens blancs pour le BTS Métiers de l'audiovisuel, option Métiers du son.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={webSiteJsonLd()} />
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-amber focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg"
        >
          Aller au contenu
        </a>
        <AppProviders>
          <SiteHeader />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
