import type { Metadata } from "next";
import Link from "next/link";
import { ANNALES, annaleSlug } from "@/data/annales";

export const metadata: Metadata = {
  title: "Annales BTS Audiovisuel option Son — sujets officiels E3 PTES 2017-2025",
  description:
    "Tous les sujets officiels de l'épreuve E3 PTES (option Métiers du son) 2017-2025 en accès direct depuis éduscol, plus les sujets CAA et les sujets zéro. Sources officielles marquées.",
};

export default function AnnalesPage() {
  const e3 = ANNALES.filter((a) => a.epreuve.startsWith("E3"));
  const caa = ANNALES.filter((a) => a.epreuve.includes("CAA") || a.epreuve.includes("Thème"));
  const autres = ANNALES.filter((a) => !e3.includes(a) && !caa.includes(a));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Bibliothèque d&apos;annales
        </h1>
        <p className="mt-4 leading-relaxed text-ink-mute">
          Tous les sujets publics du BTS MAV option Son, indexés avec leur lien direct.
          L&apos;épreuve <strong className="text-ink">E3 PTES</strong> est la seule épreuve
          écrite spécifique Son dont les sujets sont publiés : c&apos;est votre meilleure
          source d&apos;entraînement. Les liens marqués{" "}
          <span className="rounded-full bg-signal-dim px-2 py-0.5 font-mono text-[11px] text-signal">officiel</span>{" "}
          pointent vers éduscol / education.gouv ; les autres sont des sites tiers, signalés
          comme tels.
        </p>
        <p className="mt-3 rounded-md border border-line bg-surface p-3 text-xs leading-relaxed text-ink-faint">
          À savoir : E4 (pratique), E5 (oral de projet) et E6 (stage) n&apos;ont pas de sujets
          publics — par nature. Les corrigés E3-Son ne sont pas diffusés officiellement.
        </p>
      </header>

      <Section
        title="E3 — Physique et technique des équipements et supports (option Son)"
        subtitle="Sessions 2017 à 2025 + sujet zéro — écrit de 6 h, coefficient 4"
        entries={e3}
      />
      <Section
        title="E1 — Culture audiovisuelle et artistique (commun)"
        subtitle="Sujets, éléments de correction et thèmes nationaux annuels (notes BO)"
        entries={caa}
      />
      <Section
        title="Hubs & ressources transverses"
        subtitle="Pages officielles regroupant les sujets par session, et archives tierces"
        entries={autres}
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: typeof ANNALES;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-faint">{subtitle}</p>
      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-raised text-left">
              <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Session</th>
              <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Type</th>
              <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Source</th>
              <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Statut</th>
              <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Lien</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((a, i) => (
              <tr key={i} className="odd:bg-surface even:bg-bg">
                <td className="border-b border-line px-4 py-2.5 font-mono text-ink">{a.session}</td>
                <td className="border-b border-line px-4 py-2.5 text-ink-mute">{a.type}{a.epreuve.includes("Thème") ? " (thème)" : ""}</td>
                <td className="border-b border-line px-4 py-2.5 text-ink-mute">{a.source}</td>
                <td className="border-b border-line px-4 py-2.5">
                  {a.official ? (
                    <span className="rounded-full bg-signal-dim px-2.5 py-0.5 font-mono text-[11px] text-signal">officiel</span>
                  ) : (
                    <span className="rounded-full bg-amber-dim px-2.5 py-0.5 font-mono text-[11px] text-amber-bright">tiers</span>
                  )}
                </td>
                <td className="border-b border-line px-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <Link
                      href={`/annales/${annaleSlug(a)}`}
                      className="font-medium text-ink-mute underline-offset-4 hover:text-ink hover:underline"
                    >
                      Fiche
                    </Link>
                    <a
                      href={a.lien}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-cue underline-offset-4 hover:underline"
                    >
                      Ouvrir ↗
                    </a>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
