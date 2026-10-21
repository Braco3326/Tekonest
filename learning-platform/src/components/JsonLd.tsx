/** Renders a JSON-LD structured-data block. Server component. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const BASE = "https://teknest.fr";

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Tech Nest",
    url: BASE,
    logo: `${BASE}/icon.svg`,
    description:
      "Plateforme de préparation gratuite au BTS Métiers de l'audiovisuel, option Métiers du son — conforme au référentiel officiel (arrêté du 4 juin 2013, RNCP37196).",
    sameAs: ["https://github.com/Braco3326/Technest"],
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Tech Nest",
    url: BASE,
    inLanguage: "fr-FR",
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${BASE}${it.path}`,
    })),
  };
}

export function courseJsonLd(params: {
  slug: string;
  title: string;
  description: string;
  epreuve: string;
  available: boolean;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: params.title,
    description: params.description,
    url: `${BASE}/cours/${params.slug}`,
    inLanguage: "fr-FR",
    provider: {
      "@type": "EducationalOrganization",
      name: "Tech Nest",
      url: BASE,
    },
    isAccessibleForFree: true,
    educationalLevel: "BTS (bac+2)",
    teaches: `Épreuve ${params.epreuve} du BTS Métiers de l'audiovisuel, option Métiers du son`,
    ...(params.available
      ? {
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            courseWorkload: "PT5H",
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            category: "Free",
          },
        }
      : {}),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}
