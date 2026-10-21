import Link from "next/link";
import type { Metadata } from "next";
import { COURSES } from "@/data/courses";
import { TOTAL_COEFFICIENTS } from "@/data/referentiel";
import { ANNALES } from "@/data/annales";
import { JsonLd, faqJsonLd } from "@/components/JsonLd";

const FAQ_ITEMS = [
  {
    question: "Quelles sont les épreuves du BTS Métiers de l'audiovisuel, option Métiers du son ?",
    answer:
      "Le règlement d'examen (arrêté du 4 juin 2013) compte 7 épreuves obligatoires pour un total de 17 coefficients : E1 Culture audiovisuelle et artistique (coef. 2), E2 Anglais (coef. 1), E3 Physique et technique des équipements et supports (coef. 4), E4 Techniques et mise en œuvre (coef. 4), E51 Projet à caractère industriel (coef. 4), E52 Environnement économique et juridique (coef. 1) et E6 Situation en milieu professionnel (coef. 1).",
  },
  {
    question: "Où trouver les annales officielles de l'épreuve E3 PTES ?",
    answer:
      "Les sujets officiels de l'E3 PTES (la seule épreuve écrite spécifique Son dont les sujets sont publics) sont publiés par éduscol STI pour les sessions 2017 à 2025. Tech Nest les indexe tous dans sa bibliothèque d'annales avec des liens directs vers les documents officiels.",
  },
  {
    question: "Comment réviser l'épreuve E3 PTES (coefficient 4) ?",
    answer:
      "L'E3 est un écrit de 6 heures (3h+3h) qui couvre l'acoustique, l'électricité du signal audio, les transducteurs, l'audionumérique, le traitement du signal et les chaînes d'équipements. Tech Nest propose un cours complet gratuit en 6 unités avec quiz, un examen blanc de type annales et un certificat de compétences.",
  },
  {
    question: "Les cours Tech Nest sont-ils gratuits ?",
    answer:
      "Oui. Les cours sont gratuits et auto-rythmés : unités (leçon + quiz), enquête, puis examen final. Un score d'au moins 70 % délivre un certificat nominatif listant les compétences RNCP37196 démontrées, valable 3 ans et vérifiable par code.",
  },
];

export const metadata: Metadata = {
  title: "Tech Nest — Réussir le BTS Audiovisuel option Son",
  description:
    "Cours gratuits, examens blancs et annales officielles pour le BTS Métiers de l'audiovisuel option Métiers du son. Chaque cours est aligné sur une épreuve du référentiel officiel (RNCP37196).",
};

const meterBars = [0.9, 0.5, 1.1, 0.7, 1.3, 0.6, 1, 0.8, 1.2, 0.55, 0.95, 0.75];

export default function HomePage() {
  const e3 = COURSES.find((c) => c.id === "e3-ptes")!;
  const annalesCount = ANNALES.filter((a) => a.official).length;

  return (
    <>
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />
      {/* ============ HERO ============ */}
      <section className="tn-grid-texture relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(232,176,75,0.10), transparent), linear-gradient(to bottom, transparent 40%, var(--tn-bg))",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-mute">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
            Conforme au référentiel officiel — arrêté du 4 juin 2013 · RNCP37196
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Le BTS Son se prépare
            <br />
            <span className="text-amber">épreuve par épreuve.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-mute">
            Tech Nest est la seule plateforme dédiée au BTS Métiers de l&apos;audiovisuel,
            option <strong className="text-ink">Métiers du son</strong>. Des cours gratuits
            mappés sur les épreuves E1 à E6 et leurs vrais coefficients, les annales
            officielles, et des certificats qui nomment les compétences démontrées.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/cours/${e3.slug}`}
              className="rounded-sm bg-amber px-6 py-3 text-sm font-semibold text-bg shadow-[var(--tn-shadow-glow-amber)] transition-colors hover:bg-amber-bright"
            >
              Commencer le cours E3 · PTES
            </Link>
            <Link
              href="/cours"
              className="rounded-sm border border-line-strong bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-overlay"
            >
              Voir le parcours complet
            </Link>
          </div>

          {/* meter strip */}
          <div className="mt-14 flex h-10 items-end gap-1.5" aria-hidden="true">
            {meterBars.map((d, i) => (
              <div
                key={i}
                className="w-1.5 origin-bottom rounded-t-[2px]"
                style={{
                  height: "100%",
                  background:
                    i % 4 === 3 ? "var(--tn-amber)" : "var(--tn-signal)",
                  opacity: 0.75,
                  animation: `tn-meter ${d + 0.9}s ease-in-out ${i * 0.11}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHY / TRUST ============ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Pourquoi Tech Nest existe
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-mute">
          Les plateformes de révision s&apos;arrêtent au bac ou traitent les cinq options du
          BTS MAV en bloc. Personne ne couvre l&apos;option Son en profondeur — alors que le
          bloc technique (E3 + E4 + E51, coefficients 4+4+4 sur {TOTAL_COEFFICIENTS}) décide
          de votre diplôme.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Mappé sur le référentiel",
              body: "Chaque cours correspond à une épreuve (E1–E6) avec son vrai coefficient et son bloc de compétences RNCP37196. Vous savez toujours pourquoi vous travaillez.",
              accent: "var(--tn-amber)",
            },
            {
              title: "Sources officielles, pas de promesses",
              body: `Pas de « 100 % de réussite » invérifiable : nous citons l'arrêté du 4 juin 2013, France Compétences et éduscol. ${annalesCount} ressources officielles indexées dans la bibliothèque d'annales.`,
              accent: "var(--tn-signal)",
            },
            {
              title: "Gratuit et certifiant",
              body: "Les cours sont gratuits et auto-rythmés : unités → enquête → examen final (≥ 70 %). Le certificat nomme les compétences démontrées, valable 3 ans, vérifiable par code.",
              accent: "var(--tn-cue)",
            },
          ].map((card) => (
            <article key={card.title} className="rounded-md border border-line bg-surface p-6">
              <div className="mb-4 h-1 w-10 rounded-full" style={{ background: card.accent }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold text-ink">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-mute">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============ THE MODEL ============ */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Un modèle simple, exigeant, gratuit
          </h2>
          <div className="mt-10 grid gap-0 overflow-hidden rounded-md border border-line md:grid-cols-4">
            {[
              { n: "01", t: "Unités", d: "Leçons structurées avec exercices résolus, puis quiz de validation par unité." },
              { n: "02", t: "Enquête", d: "Votre retour sur le cours — obligatoire avant l'examen, comme dans les certifications professionnelles." },
              { n: "03", t: "Examen final", d: "Débloqué uniquement quand toutes les unités et l'enquête sont complètes. Style annales." },
              { n: "04", t: "Certificat", d: "≥ 70 % : certificat nominatif listant les compétences RNCP démontrées. Valable 3 ans, re-téléchargeable." },
            ].map((step, i) => (
              <div key={step.n} className={`bg-bg p-6 ${i > 0 ? "border-t border-line md:border-l md:border-t-0" : ""}`}>
                <p className="font-mono text-xs text-amber">{step.n}</p>
                <h3 className="mt-2 font-display text-base font-semibold text-ink">{step.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-mute">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TUTEUR IA ============ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 md:order-1 rounded-md border border-line bg-surface p-5">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-faint">
              Aperçu — une conversation type
            </p>
            <div className="space-y-3 text-sm">
              <div className="ml-8 rounded-md bg-raised px-3.5 py-2.5 leading-relaxed text-ink">
                Donne-moi juste la réponse : 94 dB SPL à 1 m, quel niveau à 8 m ?
              </div>
              <div className="mr-8 rounded-md border border-line bg-bg px-3.5 py-2.5 leading-relaxed text-ink-mute">
                Je ne vais pas vous donner la réponse — c&apos;est vous qui passez l&apos;épreuve.
                Mais décomposons : de 1 m à 8 m, combien de doublements de distance ?
                Et que fait chaque doublement au niveau, en champ libre ?{" "}
                <span className="inline-block rounded-sm bg-cue-dim px-1.5 py-0.5 font-mono text-[10px] text-cue align-baseline">
                  Cours E3 · Acoustique
                </span>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="font-mono text-xs uppercase tracking-wide text-amber">Nouveau</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Un tuteur IA qui vous guide — sans tricher à votre place
            </h2>
            <p className="mt-3 leading-relaxed text-ink-mute">
              Le tuteur de Tech Nest est socratique : il décompose les questions d&apos;annales,
              génère des exercices ciblés et repère vos points faibles — mais il ne donne
              jamais la réponse d&apos;une évaluation. Il ne répond que depuis le cours et le
              référentiel officiel, et cite sa source à chaque affirmation.
            </p>
            <Link
              href="/tuteur"
              className="mt-6 inline-block rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-overlay"
            >
              Ouvrir le tuteur IA →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ ANNALES TEASER ============ */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Toutes les annales officielles, au même endroit
            </h2>
            <p className="mt-3 leading-relaxed text-ink-mute">
              L&apos;E3 PTES est la seule épreuve écrite spécifique Son dont les sujets sont
              publics : sessions 2017 à 2025, directement depuis éduscol, plus les sujets
              zéro et les ressources CAA. Chaque lien est marqué officiel ou tiers.
            </p>
            <Link
              href="/annales"
              className="mt-6 inline-block rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-overlay"
            >
              Ouvrir la bibliothèque d&apos;annales →
            </Link>
          </div>
          <div className="rounded-md border border-line bg-surface p-5">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-faint">
              Aperçu — sujets E3 PTES (option Son)
            </p>
            <ul className="divide-y divide-line text-sm">
              {ANNALES.filter((a) => a.epreuve === "E3 PTES").slice(0, 5).map((a) => (
                <li key={a.session} className="flex items-center justify-between py-2.5">
                  <span className="text-ink">Session {a.session}</span>
                  <span className="rounded-full bg-signal-dim px-2.5 py-0.5 font-mono text-[11px] text-signal">
                    officiel · éduscol
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Questions fréquentes
          </h2>
          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-md border border-line bg-bg p-5 open:border-line-strong"
              >
                <summary className="cursor-pointer list-none font-display text-base font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 font-mono text-xs text-amber" aria-hidden="true">
                    ?
                  </span>
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-mute">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
