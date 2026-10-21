import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COURSES, getCourseBySlug } from "@/data/courses";
import { getBloc, getEpreuve } from "@/data/referentiel";
import { CourseOutline } from "@/components/CourseOutline";
import { SimulatorEmbed } from "@/components/SimulatorEmbed";
import { DRAFT_PLANS } from "@/data/courses/draftPlans";
import { JsonLd, breadcrumbJsonLd, courseJsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourseBySlug(slug);
  if (!course) return {};
  return {
    title: `${course.title} — Épreuve ${course.epreuve} (coef. ${getEpreuve(course.epreuve)?.coefficient})`,
    description: course.description,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourseBySlug(slug);
  if (!course) notFound();
  const epreuve = getEpreuve(course.epreuve)!;
  const blocs = course.blocs.map((b) => getBloc(b)!);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <JsonLd
        data={courseJsonLd({
          slug: course.slug,
          title: course.title,
          description: course.description,
          epreuve: course.epreuve,
          available: course.status === "available",
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Cours", path: "/cours" },
          { name: course.shortTitle, path: `/cours/${course.slug}` },
        ])}
      />
      {/* référentiel header */}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-raised px-2.5 py-1 font-mono text-sm font-semibold text-amber">
            Épreuve {course.epreuve}
          </span>
          <span className="rounded-sm border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-mute">
            unité {epreuve.unite}
          </span>
          <span className="rounded-sm border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-mute">
            coefficient {epreuve.coefficient}
          </span>
          <span className="rounded-sm border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-mute">
            {epreuve.formePonctuelle} · {epreuve.duree}
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {course.title}
        </h1>
        <p className="mt-4 leading-relaxed text-ink-mute">{course.description}</p>

        {/* blocs de compétences */}
        <div className="mt-6 rounded-md border border-line bg-surface p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Blocs de compétences RNCP37196 visés
          </p>
          <ul className="mt-2 space-y-1.5">
            {blocs.map((b) => (
              <li key={b.code} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-amber">{b.rncp}</span>
                <span className="text-ink">{b.intitule}</span>
                <span className="text-xs text-ink-faint">({b.nature})</span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* E4 seam: the Audio Simulator embeds here (graceful when offline) */}
      {course.id === "e4-tmo" && <SimulatorEmbed />}

      {/* Stub courses: sourced draft plan, explicitly marked as such */}
      {course.status === "stub" && DRAFT_PLANS[course.id] && (
        <section className="mt-8 rounded-md border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-dim px-2.5 py-0.5 font-mono text-[11px] text-amber-bright">
              brouillon — à valider par l&apos;expert
            </span>
            <h2 className="font-display text-lg font-semibold text-ink">
              Programme envisagé
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">
            {DRAFT_PLANS[course.id].intro} Chaque point est justifié par les sources officielles
            indexées (règlement d&apos;examen, grille horaire, base documentaire) — rien d&apos;autre.
          </p>
          <ul className="mt-4 space-y-3">
            {DRAFT_PLANS[course.id].themes.map((t) => (
              <li key={t.title} className="rounded-sm border border-line bg-bg p-3.5">
                <p className="text-sm text-ink">
                  {t.title}
                  {t.hypothesis && (
                    <span className="ml-2 rounded-full bg-clip-dim px-2 py-0.5 font-mono text-[10px] text-clip align-middle">
                      hypothèse à confirmer
                    </span>
                  )}
                </p>
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-faint">
                  Source : {t.source}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-sm border border-line bg-bg p-3.5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              Ce que les sources ne documentent pas encore
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-mute">
              {DRAFT_PLANS[course.id].gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* outline (client: progress + gating) */}
      <div className="mt-10">
        <CourseOutline courseId={course.id} />
      </div>
    </div>
  );
}
