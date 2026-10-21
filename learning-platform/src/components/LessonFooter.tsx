"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuth, useCourseProgress } from "@/lib/providers";

/**
 * Marks the lesson as read (once, on view, for logged-in users) and routes
 * to the unit quiz. The real completion gate is the quiz.
 */
export function LessonFooter({
  courseId,
  courseSlug,
  unitId,
  unitSlug,
  quizLength,
}: {
  courseId: string;
  courseSlug: string;
  unitId: string;
  unitSlug: string;
  quizLength: number;
}) {
  const { user } = useAuth();
  const { progress, ready, actions } = useCourseProgress(courseId);

  useEffect(() => {
    if (user && ready && !progress.units[unitId]?.lessonReadAt) {
      actions.markLessonRead(unitId);
    }
  }, [user, ready, progress.units, unitId, actions]);

  const passed = Boolean(progress.units[unitId]?.quizPassedAt);

  return (
    <div className="mt-12 space-y-4">
      <div className="rounded-md border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              {passed ? "Quiz déjà validé ✓" : "Valider cette unité"}
            </h2>
            <p className="mt-1 text-sm text-ink-mute">
              {passed
                ? "Vous pouvez le repasser pour vous entraîner — votre meilleur score est conservé."
                : `Quiz de ${quizLength} questions — ≥ 70 % pour valider l'unité.`}
              {!user && " Connectez-vous pour enregistrer votre progression."}
            </p>
          </div>
          <Link
            href={`/cours/${courseSlug}/unite/${unitSlug}/quiz`}
            className="rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-amber-bright"
          >
            {passed ? "Repasser le quiz" : "Passer le quiz →"}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg px-6 py-4">
        <p className="text-sm text-ink-mute">
          Une notion résiste ? Le tuteur IA vous guide sur cette unité — sans donner les réponses.
        </p>
        <Link
          href={`/tuteur?unite=${unitSlug}`}
          className="rounded-sm border border-line-strong bg-surface px-4 py-2 font-mono text-xs text-ink transition-colors hover:bg-overlay"
        >
          Demander au tuteur →
        </Link>
      </div>
    </div>
  );
}
