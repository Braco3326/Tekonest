"use client";

import Link from "next/link";
import { LEARNING_PATH, getCourseById } from "@/data/courses";
import { getEpreuve } from "@/data/referentiel";
import { useAllProgress, useAuth } from "@/lib/providers";
import { courseCompletion, isCertificateEarned, emptyCourseProgress } from "@/lib/progress/model";
import type { Course } from "@/data/types";

function StatusBadge({ course, certified, started }: { course: Course; certified: boolean; started: boolean }) {
  if (course.status === "stub") {
    return (
      <span className="rounded-full border border-line bg-raised px-2.5 py-0.5 font-mono text-[11px] text-ink-faint">
        en préparation
      </span>
    );
  }
  if (certified) {
    return (
      <span className="rounded-full bg-signal-dim px-2.5 py-0.5 font-mono text-[11px] text-signal">
        ✓ certifié
      </span>
    );
  }
  if (started) {
    return (
      <span className="rounded-full bg-amber-dim px-2.5 py-0.5 font-mono text-[11px] text-amber-bright">
        en cours
      </span>
    );
  }
  return (
    <span className="rounded-full bg-cue-dim px-2.5 py-0.5 font-mono text-[11px] text-cue">
      disponible · gratuit
    </span>
  );
}

export function LearningPath() {
  const { user } = useAuth();
  const { all } = useAllProgress();

  const certifiedIds = new Set(
    LEARNING_PATH.filter((c) => {
      const p = all[c.id];
      return p && isCertificateEarned(c, p);
    }).map((c) => c.id)
  );

  return (
    <ol className="relative space-y-4">
      {/* path spine */}
      <div className="absolute bottom-6 left-[19px] top-6 w-px bg-line" aria-hidden="true" />
      {LEARNING_PATH.map((course) => {
        const epreuve = getEpreuve(course.epreuve)!;
        const progress = all[course.id] ?? emptyCourseProgress(course.id);
        const completion = courseCompletion(course, progress);
        const certified = certifiedIds.has(course.id);
        const started = completion > 0;
        const available = course.status === "available";
        const prereqTitles = course.prerequisites
          .map((id) => getCourseById(id)?.shortTitle)
          .filter(Boolean);

        const inner = (
          <div
            className={`relative rounded-md border bg-surface p-5 transition-colors ${
              available
                ? "border-line hover:border-amber"
                : "border-line opacity-75"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-raised px-2 py-0.5 font-mono text-xs font-semibold text-amber">
                    {course.epreuve}
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    coef. {epreuve.coefficient} · {epreuve.formePonctuelle.toLowerCase()} · {epreuve.duree}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-ink">
                  {course.title}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-mute">
                  {course.description}
                </p>
                {prereqTitles.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-ink-faint">
                    prérequis conseillé : {prereqTitles.join(", ")}
                  </p>
                )}
              </div>
              <StatusBadge course={course} certified={certified} started={started} />
            </div>
            {available && user && (
              <div className="mt-4">
                <div className="h-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${certified ? "bg-signal" : "bg-amber"}`}
                    style={{ width: `${Math.round(completion * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
                  {Math.round(completion * 100)} % complété
                </p>
              </div>
            )}
          </div>
        );

        return (
          <li key={course.id} className="relative flex gap-4">
            <div
              className={`relative z-10 mt-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
                certified
                  ? "border-signal bg-signal-dim text-signal"
                  : available
                    ? "border-amber bg-amber-dim text-amber-bright"
                    : "border-line bg-raised text-ink-faint"
              }`}
              aria-hidden="true"
            >
              {certified ? "✓" : course.epreuve}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/cours/${course.slug}`} className="block">
                {inner}
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
