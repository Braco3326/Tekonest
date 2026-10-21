/**
 * Weak-spot detection — pure function over the ProgressStore domain model.
 * Consumed by the tutor to target révisions; unit-tested in weakSpots.test.ts.
 */

import type { Course } from "@/data/types";
import type { CourseProgress } from "@/lib/progress/model";
import { UNIT_QUIZ_PASS, bestExamScore } from "@/lib/progress/model";
import type { WeakSpot } from "./types";

/** Below this quiz score, a passed unit is still considered fragile. */
export const FRAGILE_THRESHOLD = 0.85;

export function computeWeakSpots(course: Course, progress: CourseProgress): WeakSpot[] {
  const spots: WeakSpot[] = [];

  for (const unit of course.units) {
    const u = progress.units[unit.id];
    if (!u || (!u.lessonReadAt && u.quizBestScore === undefined)) {
      spots.push({
        unitId: unit.id,
        unitTitle: unit.title,
        kind: "non-commence",
        detail: "Unité non commencée",
      });
      continue;
    }
    if (u.quizBestScore !== undefined && u.quizBestScore < UNIT_QUIZ_PASS) {
      spots.push({
        unitId: unit.id,
        unitTitle: unit.title,
        kind: "quiz-echoue",
        detail: `Quiz échoué — meilleur score ${Math.round(u.quizBestScore * 100)} % (seuil ${Math.round(UNIT_QUIZ_PASS * 100)} %)`,
      });
      continue;
    }
    if (
      u.quizBestScore !== undefined &&
      u.quizBestScore >= UNIT_QUIZ_PASS &&
      u.quizBestScore < FRAGILE_THRESHOLD
    ) {
      spots.push({
        unitId: unit.id,
        unitTitle: unit.title,
        kind: "quiz-fragile",
        detail: `Quiz réussi de justesse — ${Math.round(u.quizBestScore * 100)} %`,
      });
    }
  }

  const best = bestExamScore(progress);
  const passing = course.exam?.passingScore ?? 0.7;
  if (best !== null && best < passing) {
    spots.push({
      unitId: "exam",
      unitTitle: "Examen blanc",
      kind: "examen-non-valide",
      detail: `Examen blanc non validé — meilleur score ${Math.round(best * 100)} % (seuil ${Math.round(passing * 100)} %)`,
    });
  }

  return spots;
}
