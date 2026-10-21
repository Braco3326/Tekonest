"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { getCourseBySlug } from "@/data/courses";
import { QuizRunner } from "@/components/QuizRunner";
import { useAuth, useCourseProgress } from "@/lib/providers";
import { UNIT_QUIZ_PASS } from "@/lib/progress/model";

export default function UnitQuizPage({
  params,
}: {
  params: Promise<{ slug: string; unitSlug: string }>;
}) {
  const { slug, unitSlug } = use(params);
  const course = getCourseBySlug(slug);
  const unit = course?.units.find((u) => u.slug === unitSlug);
  if (!course || !unit) notFound();

  const { user, loading } = useAuth();
  const { actions } = useCourseProgress(course.id);
  const index = course.units.findIndex((u) => u.id === unit.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav className="mb-8 font-mono text-xs text-ink-faint" aria-label="Fil d'Ariane">
        <Link href={`/cours/${course.slug}`} className="hover:text-ink-mute">
          {course.epreuve} · {course.shortTitle}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/cours/${course.slug}/unite/${unit.slug}`} className="hover:text-ink-mute">
          Unité {index + 1}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-mute">Quiz</span>
      </nav>

      {!loading && !user && (
        <div className="mb-6 rounded-md border border-amber bg-amber-dim p-4 text-sm text-ink">
          Vous n&apos;êtes pas connecté·e : le score ne sera pas enregistré.{" "}
          <Link href="/connexion" className="font-medium text-amber-bright underline underline-offset-4">
            Se connecter
          </Link>
        </div>
      )}

      <QuizRunner
        questions={unit.quiz}
        passThreshold={UNIT_QUIZ_PASS}
        title={`Quiz — ${unit.title}`}
        onFinish={(score, passed) => {
          if (user) void actions.saveQuizResult(unit.id, score, passed);
        }}
      />

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href={`/cours/${course.slug}/unite/${unit.slug}`}
          className="rounded-sm border border-line bg-surface px-4 py-2 text-ink-mute hover:bg-overlay hover:text-ink"
        >
          ← Relire la leçon
        </Link>
        <Link
          href={`/cours/${course.slug}`}
          className="rounded-sm border border-line bg-surface px-4 py-2 text-ink-mute hover:bg-overlay hover:text-ink"
        >
          Retour au programme du cours
        </Link>
      </div>
    </div>
  );
}
