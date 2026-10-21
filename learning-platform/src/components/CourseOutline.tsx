"use client";

import Link from "next/link";
import { getCourseById } from "@/data/courses";
import { useAuth, useCourseProgress } from "@/lib/providers";
import {
  isCertificateEarned,
  isExamUnlocked,
  isSurveyComplete,
  isUnitComplete,
  bestExamScore,
} from "@/lib/progress/model";

function Row({
  href,
  locked,
  done,
  index,
  title,
  meta,
  cta,
}: {
  href: string | null;
  locked: boolean;
  done: boolean;
  index: string;
  title: string;
  meta: string;
  cta: string;
}) {
  const body = (
    <div
      className={`flex items-center gap-4 rounded-md border p-4 transition-colors ${
        locked
          ? "border-line bg-surface opacity-55"
          : done
            ? "border-line bg-surface hover:border-signal"
            : "border-line bg-surface hover:border-amber"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
          done
            ? "border-signal bg-signal-dim text-signal"
            : locked
              ? "border-line bg-raised text-ink-faint"
              : "border-amber bg-amber-dim text-amber-bright"
        }`}
        aria-hidden="true"
      >
        {done ? "✓" : locked ? "🔒" : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{meta}</p>
      </div>
      {!locked && (
        <span className="shrink-0 text-sm font-medium text-amber-bright">{cta} →</span>
      )}
    </div>
  );
  if (locked || !href) return <div aria-disabled="true">{body}</div>;
  return <Link href={href}>{body}</Link>;
}

export function CourseOutline({ courseId }: { courseId: string }) {
  const course = getCourseById(courseId)!;
  const { user, loading } = useAuth();
  const { progress, ready } = useCourseProgress(courseId);

  if (course.status === "stub") {
    return (
      <div className="rounded-md border border-dashed border-line-strong bg-surface p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-amber">en préparation</p>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-ink-mute">{course.stubNote}</p>
        <p className="mt-4 text-sm text-ink-faint">
          En attendant, le cours{" "}
          <Link href="/cours/e3-ptes" className="text-amber-bright underline-offset-4 hover:underline">
            E3 · PTES
          </Link>{" "}
          est complet et gratuit.
        </p>
      </div>
    );
  }

  if (!loading && !user) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-amber bg-amber-dim p-5">
          <p className="text-sm leading-relaxed text-ink">
            <strong>Créez un compte gratuit</strong> pour suivre votre progression,
            débloquer l&apos;examen final et obtenir votre certificat.{" "}
            <Link href="/inscription" className="font-medium text-amber-bright underline underline-offset-4">
              S&apos;inscrire
            </Link>{" "}
            ·{" "}
            <Link href="/connexion" className="font-medium text-amber-bright underline underline-offset-4">
              Se connecter
            </Link>
          </p>
        </div>
        <PlanPreview courseId={courseId} />
      </div>
    );
  }

  if (!ready) {
    return <div className="h-40 animate-pulse rounded-md border border-line bg-surface" aria-busy="true" />;
  }

  const allUnitsDone = course.units.every((u) => isUnitComplete(progress, u.id));
  const surveyDone = isSurveyComplete(progress);
  const examUnlocked = isExamUnlocked(course, progress);
  const certified = isCertificateEarned(course, progress);
  const best = bestExamScore(progress);

  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-ink">Programme du cours</h2>
      <p className="mb-5 text-sm leading-relaxed text-ink-mute">
        Terminez les {course.units.length} unités (leçon + quiz ≥ 70 %) et l&apos;enquête de
        fin de cours pour débloquer l&apos;examen final. Un score ≥ 70 % à l&apos;examen délivre
        le certificat.
      </p>

      {course.units.map((unit, i) => {
        const done = isUnitComplete(progress, unit.id);
        const u = progress.units[unit.id];
        return (
          <Row
            key={unit.id}
            href={`/cours/${course.slug}/unite/${unit.slug}`}
            locked={false}
            done={done}
            index={String(i + 1)}
            title={unit.title}
            meta={`≈ ${unit.estimatedMinutes} min · quiz de ${unit.quiz.length} questions${
              u?.quizBestScore !== undefined ? ` · meilleur score ${Math.round(u.quizBestScore * 100)} %` : ""
            }`}
            cta={done ? "Revoir" : u?.lessonReadAt ? "Continuer" : "Commencer"}
          />
        );
      })}

      <Row
        href={`/cours/${course.slug}/enquete`}
        locked={!allUnitsDone && !surveyDone}
        done={surveyDone}
        index="★"
        title="Enquête de fin de cours"
        meta={
          surveyDone
            ? "merci pour votre retour"
            : allUnitsDone
              ? "2 minutes — obligatoire avant l'examen"
              : "se débloque quand toutes les unités sont terminées"
        }
        cta={surveyDone ? "Revoir" : "Répondre"}
      />

      <Row
        href={`/cours/${course.slug}/examen`}
        locked={!examUnlocked && !certified}
        done={certified}
        index="E"
        title="Examen final"
        meta={
          certified
            ? `certificat obtenu — meilleur score ${Math.round((best ?? 0) * 100)} %`
            : examUnlocked
              ? `${course.exam?.questions.length ?? 0} questions · ≥ ${Math.round((course.exam?.passingScore ?? 0.7) * 100)} % pour le certificat${best !== null ? ` · meilleur score ${Math.round(best * 100)} %` : ""}`
              : "se débloque quand toutes les unités ET l'enquête sont complètes"
        }
        cta={certified ? "Repasser" : "Passer l'examen"}
      />

      {certified && progress.certificateId && (
        <div className="rounded-md border border-signal bg-signal-dim p-4 text-sm">
          <p className="text-ink">
            🎓 Certificat obtenu.{" "}
            <Link
              href={`/certificats/${progress.certificateId}`}
              className="font-medium text-signal underline underline-offset-4"
            >
              Voir / télécharger mon certificat
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

/** Read-only outline for visitors (SEO-friendly content is on the server page). */
function PlanPreview({ courseId }: { courseId: string }) {
  const course = getCourseById(courseId)!;
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-ink">Programme du cours</h2>
      {course.units.map((unit, i) => (
        <Row
          key={unit.id}
          href={`/cours/${course.slug}/unite/${unit.slug}`}
          locked={false}
          done={false}
          index={String(i + 1)}
          title={unit.title}
          meta={`≈ ${unit.estimatedMinutes} min · quiz de ${unit.quiz.length} questions`}
          cta="Lire la leçon"
        />
      ))}
      <Row
        href={null}
        locked={true}
        done={false}
        index="★"
        title="Enquête de fin de cours"
        meta="réservée aux comptes connectés"
        cta=""
      />
      <Row
        href={null}
        locked={true}
        done={false}
        index="E"
        title="Examen final + certificat"
        meta="réservé aux comptes connectés"
        cta=""
      />
    </div>
  );
}
