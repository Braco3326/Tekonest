import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ANNALES, annaleSlug, getAnnaleBySlug } from "@/data/annales";
import { EPREUVES } from "@/data/referentiel";
import { getCourseBySlug } from "@/data/courses";
import { JsonLd, breadcrumbJsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return ANNALES.map((a) => ({ slug: annaleSlug(a) }));
}

/** Matches an annale to its épreuve in the règlement, when unambiguous. */
function relatedEpreuve(epreuveLabel: string) {
  const code = epreuveLabel.match(/^E\d+/)?.[0] ?? (epreuveLabel.includes("CAA") ? "E1" : null);
  return code ? EPREUVES.find((e) => e.code === code) : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getAnnaleBySlug(slug);
  if (!a) return {};
  return {
    title: `${a.epreuve} — ${a.type}, session ${a.session} · Annales BTS Audiovisuel Son`,
    description: `${a.type} ${a.official ? "officiel" : "(source tierce)"} de l'épreuve ${a.epreuve} du BTS Métiers de l'audiovisuel option Son, session ${a.session}. Accès direct au document (source : ${a.source}).`,
  };
}

export default async function AnnaleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getAnnaleBySlug(slug);
  if (!a) notFound();
  const epreuve = relatedEpreuve(a.epreuve);
  const e3Course = a.epreuve.startsWith("E3") ? getCourseBySlug("e3-ptes") : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Annales", path: "/annales" },
          { name: `${a.epreuve} ${a.session}`, path: `/annales/${slug}` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: `${a.epreuve} — ${a.type}, session ${a.session}`,
          url: `https://teknest.fr/annales/${slug}`,
          inLanguage: "fr-FR",
          educationalLevel: "BTS (bac+2)",
          isAccessibleForFree: true,
          learningResourceType: a.type,
          mainEntity: a.lien,
        }}
      />

      <nav className="mb-8 font-mono text-xs text-ink-faint" aria-label="Fil d'Ariane">
        <Link href="/annales" className="hover:text-ink-mute">
          Annales
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-mute">
          {a.epreuve} · {a.session}
        </span>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          {a.official ? (
            <span className="rounded-full bg-signal-dim px-2.5 py-0.5 font-mono text-[11px] text-signal">
              document officiel
            </span>
          ) : (
            <span className="rounded-full bg-amber-dim px-2.5 py-0.5 font-mono text-[11px] text-amber-bright">
              source tierce (non officielle)
            </span>
          )}
          <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[11px] text-ink-faint">
            {a.source}
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">
          {a.epreuve} — {a.type}, session {a.session}
        </h1>
        <p className="mt-3 leading-relaxed text-ink-mute">
          BTS Métiers de l&apos;audiovisuel{a.option !== "Toutes" && a.option !== "Commun" ? `, option ${a.option}` : ""} —
          unité {a.unite}. Statut du document : {a.statut}.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={a.lien}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm bg-amber px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-amber-bright"
        >
          Ouvrir le document ({a.source}) ↗
        </a>
        <Link
          href="/annales"
          className="rounded-sm border border-line-strong bg-surface px-5 py-3 text-sm text-ink transition-colors hover:bg-overlay"
        >
          ← Toutes les annales
        </Link>
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-faint">
        Le document est hébergé par {a.source} — Tech Nest indexe le lien, sans copie ni modification.
      </p>

      {epreuve && (
        <section className="mt-10 rounded-md border border-line bg-surface p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            L&apos;épreuve au règlement d&apos;examen (arrêté du 4 juin 2013)
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-faint">Épreuve</dt>
              <dd className="text-ink">
                {epreuve.code} — {epreuve.titre}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-faint">Coefficient</dt>
              <dd className="font-mono text-ink">{epreuve.coefficient}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-faint">Forme ponctuelle</dt>
              <dd className="text-ink">{epreuve.formePonctuelle}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-faint">Durée</dt>
              <dd className="font-mono text-ink">{epreuve.duree}</dd>
            </div>
          </dl>
        </section>
      )}

      {e3Course && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg px-5 py-4">
          <p className="text-sm text-ink-mute">
            Préparez cette épreuve avec le cours gratuit E3 · PTES : 6 unités, quiz et examen blanc
            de type annales.
          </p>
          <Link
            href={`/cours/${e3Course.slug}`}
            className="rounded-sm border border-line-strong bg-surface px-4 py-2 font-mono text-xs text-ink transition-colors hover:bg-overlay"
          >
            Réviser l&apos;E3 →
          </Link>
        </section>
      )}
    </div>
  );
}
