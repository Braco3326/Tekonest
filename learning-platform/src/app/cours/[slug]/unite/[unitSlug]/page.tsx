import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, getCourseBySlug } from "@/data/courses";
import { LessonRenderer } from "@/components/LessonRenderer";
import { LessonFooter } from "@/components/LessonFooter";
import { JsonLd, breadcrumbJsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return COURSES.flatMap((c) =>
    c.units.map((u) => ({ slug: c.slug, unitSlug: u.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; unitSlug: string }>;
}): Promise<Metadata> {
  const { slug, unitSlug } = await params;
  const course = getCourseBySlug(slug);
  const unit = course?.units.find((u) => u.slug === unitSlug);
  if (!course || !unit) return {};
  return {
    title: `${unit.title} — ${course.shortTitle}`,
    description: unit.summary,
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; unitSlug: string }>;
}) {
  const { slug, unitSlug } = await params;
  const course = getCourseBySlug(slug);
  const unit = course?.units.find((u) => u.slug === unitSlug);
  if (!course || !unit) notFound();
  const index = course.units.findIndex((u) => u.id === unit.id);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Cours", path: "/cours" },
          { name: course.shortTitle, path: `/cours/${course.slug}` },
          { name: unit.title, path: `/cours/${course.slug}/unite/${unit.slug}` },
        ])}
      />
      <nav className="mb-8 font-mono text-xs text-ink-faint" aria-label="Fil d'Ariane">
        <Link href="/cours" className="hover:text-ink-mute">Cours</Link>
        <span className="mx-2">/</span>
        <Link href={`/cours/${course.slug}`} className="hover:text-ink-mute">
          {course.epreuve} · {course.shortTitle}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-mute">Unité {index + 1}</span>
      </nav>

      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-amber">
          Unité {index + 1} / {course.units.length} · ≈ {unit.estimatedMinutes} min
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
          {unit.title}
        </h1>
        <p className="mt-3 leading-relaxed text-ink-mute">{unit.summary}</p>
      </header>

      <hr className="my-8 border-line" />

      <LessonRenderer blocks={unit.lesson} />

      <LessonFooter courseId={course.id} courseSlug={course.slug} unitId={unit.id} unitSlug={unit.slug} quizLength={unit.quiz.length} />
    </article>
  );
}
