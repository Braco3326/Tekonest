import type { Metadata } from "next";
import Link from "next/link";
import { EPREUVES, GRILLE_HORAIRE, SOURCES_OFFICIELLES, TOTAL_COEFFICIENTS } from "@/data/referentiel";

export const metadata: Metadata = {
  title: "À propos & sources officielles",
  description:
    "Tech Nest s'appuie exclusivement sur les textes officiels du BTS Métiers de l'audiovisuel option Son : arrêté du 4 juin 2013, fiche RNCP37196, référentiel éduscol. Toutes nos sources, vérifiables.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        La transparence est notre méthode
      </h1>
      <div className="mt-6 max-w-3xl space-y-4 leading-relaxed text-ink-mute">
        <p>
          Beaucoup de sites de préparation promettent « 100 % de réussite » sans jamais citer
          une source. Tech Nest fait l&apos;inverse : <strong className="text-ink">chaque affirmation
          sur le diplôme est adossée à un texte officiel</strong>, que vous pouvez ouvrir et
          vérifier vous-même ci-dessous.
        </p>
        <p>
          Nos contenus sont conformes au référentiel officiel du BTS Métiers de
          l&apos;audiovisuel, option Métiers du son : <strong className="text-ink">arrêté du
          4 juin 2013</strong> (modifié 2014 et 2016), enregistré au répertoire national sous
          la fiche <strong className="text-ink">RNCP37196</strong>. Les cours sont gratuits ;
          les certificats Tech Nest sont des attestations pédagogiques indépendantes — ils ne
          remplacent évidemment pas le diplôme délivré par le ministère.
        </p>
      </div>

      {/* Règlement d'examen */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-ink">
          Le règlement d&apos;examen (annexe IV de l&apos;arrêté)
        </h2>
        <p className="mt-1 text-sm text-ink-faint">
          Option Métiers du son — total des coefficients obligatoires : {TOTAL_COEFFICIENTS}.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-raised text-left">
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Épreuve</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Unité</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Coef.</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Forme ponctuelle</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Durée</th>
              </tr>
            </thead>
            <tbody>
              {EPREUVES.map((e) => (
                <tr key={e.code} className="odd:bg-surface even:bg-bg">
                  <td className="border-b border-line px-4 py-2.5 text-ink">
                    <span className="font-mono text-amber">{e.code}</span> — {e.titre}
                  </td>
                  <td className="border-b border-line px-4 py-2.5 font-mono text-ink-mute">{e.unite}</td>
                  <td className="border-b border-line px-4 py-2.5 font-mono font-bold text-ink">{e.coefficient}</td>
                  <td className="border-b border-line px-4 py-2.5 text-ink-mute">{e.formePonctuelle}</td>
                  <td className="border-b border-line px-4 py-2.5 text-ink-mute">{e.duree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Grille horaire */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-ink">
          La grille horaire (annexe III)
        </h2>
        <p className="mt-1 text-sm text-ink-faint">
          31 h/semaine · 930 h/an · 1 860 h sur 2 ans · stage de 8 à 10 semaines fin de 1re année.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-raised text-left">
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Discipline</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">1re année (h/sem)</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">2e année (h/sem)</th>
                <th className="border-b border-line px-4 py-2.5 font-medium text-ink-mute">Global/an</th>
              </tr>
            </thead>
            <tbody>
              {GRILLE_HORAIRE.map((g) => (
                <tr key={g.discipline} className="odd:bg-surface even:bg-bg">
                  <td className="border-b border-line px-4 py-2.5 text-ink">{g.discipline}</td>
                  <td className="border-b border-line px-4 py-2.5 font-mono text-ink-mute">{g.a1}</td>
                  <td className="border-b border-line px-4 py-2.5 font-mono text-ink-mute">{g.a2}</td>
                  <td className="border-b border-line px-4 py-2.5 font-mono text-ink-mute">{g.global} h</td>
                </tr>
              ))}
              <tr className="bg-raised">
                <td className="px-4 py-2.5 font-medium text-ink">TOTAL</td>
                <td className="px-4 py-2.5 font-mono font-bold text-ink">31</td>
                <td className="px-4 py-2.5 font-mono font-bold text-ink">31</td>
                <td className="px-4 py-2.5 font-mono font-bold text-ink">930 h</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Sources */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-ink">Les textes officiels</h2>
        <p className="mt-1 text-sm text-ink-faint">
          Ouvrez-les, vérifiez-nous. C&apos;est le but.
        </p>
        <ul className="mt-4 space-y-2">
          {SOURCES_OFFICIELLES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink transition-colors hover:border-cue"
              >
                <span>{s.label}</span>
                <span className="shrink-0 font-mono text-xs text-cue">ouvrir ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-md border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Et la suite ?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute">
          Le cours <Link href="/cours/e3-ptes" className="text-amber-bright underline underline-offset-4">E3 · PTES</Link> est
          complet. Les cours des autres épreuves sont en préparation, ainsi qu&apos;un
          simulateur 3D de câblage et de mise en œuvre d&apos;équipements son (E4) et un tuteur
          IA ancré sur le référentiel et les annales. Tech Nest est développé indépendamment,
          par et pour des étudiants de la filière son.
        </p>
      </section>
    </div>
  );
}
