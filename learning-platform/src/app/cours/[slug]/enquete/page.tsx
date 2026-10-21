"use client";

import Link from "next/link";
import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { getCourseBySlug } from "@/data/courses";
import { useAuth, useCourseProgress } from "@/lib/providers";
import { allUnitsComplete, isSurveyComplete } from "@/lib/progress/model";

const SCALE = [1, 2, 3, 4, 5];

export default function SurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const course = getCourseBySlug(slug);
  if (!course || course.status === "stub") notFound();

  const { user, loading } = useAuth();
  const { progress, ready, actions } = useCourseProgress(course.id);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [saved, setSaved] = useState(false);

  if (loading || !ready) {
    return <div className="mx-auto max-w-2xl px-4 py-12"><div className="h-60 animate-pulse rounded-md border border-line bg-surface" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-mute">
          Connectez-vous pour accéder à l&apos;enquête de fin de cours.{" "}
          <Link href="/connexion" className="text-amber-bright underline underline-offset-4">Se connecter</Link>
        </p>
      </div>
    );
  }

  const unitsDone = allUnitsComplete(course, progress);
  const alreadyDone = isSurveyComplete(progress);

  if (!unitsDone && !alreadyDone) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-faint">🔒 verrouillé</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
          L&apos;enquête se débloque à la fin des unités
        </h1>
        <p className="mt-3 text-ink-mute">
          Terminez d&apos;abord les {course.units.length} unités du cours (leçon + quiz ≥ 70 %).
        </p>
        <Link
          href={`/cours/${course.slug}`}
          className="mt-6 inline-block rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg hover:bg-amber-bright"
        >
          Retour au programme
        </Link>
      </div>
    );
  }

  const scaleQuestions = course.survey.filter((q) => q.kind === "scale");
  const textQuestions = course.survey.filter((q) => q.kind === "text");
  const allScaleAnswered = scaleQuestions.every((q) => answers[q.id] !== undefined);

  async function submit() {
    await actions.saveSurvey(answers);
    setSaved(true);
    setTimeout(() => router.push(`/cours/${course!.slug}`), 1200);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-amber">
        Enquête de fin de cours
      </p>
      <h1 className="mt-3 font-display text-2xl font-bold text-ink">
        Votre avis sur « {course.shortTitle} »
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-mute">
        Deux minutes, obligatoire avant l&apos;examen final — c&apos;est votre retour qui
        améliore le cours pour la promotion suivante.
      </p>

      {(saved || alreadyDone) && (
        <div className="mt-6 rounded-md border border-signal bg-signal-dim p-4 text-sm text-signal">
          ✓ Enquête enregistrée — l&apos;examen final est {saved ? "maintenant " : ""}débloqué.
          {" "}
          <Link href={`/cours/${course.slug}/examen`} className="font-medium underline underline-offset-4">
            Passer l&apos;examen
          </Link>
        </div>
      )}

      {!alreadyDone && !saved && (
        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {scaleQuestions.map((q) => (
            <fieldset key={q.id} className="rounded-md border border-line bg-surface p-5">
              <legend className="sr-only">{q.question}</legend>
              <p className="text-sm text-ink">{q.question}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink-faint">pas du tout</span>
                {SCALE.map((v) => (
                  <label
                    key={v}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border font-mono text-sm transition-colors ${
                      answers[q.id] === v
                        ? "border-amber bg-amber-dim text-amber-bright"
                        : "border-line bg-bg text-ink-mute hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="sr-only"
                      checked={answers[q.id] === v}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    />
                    {v}
                  </label>
                ))}
                <span className="font-mono text-[11px] text-ink-faint">tout à fait</span>
              </div>
            </fieldset>
          ))}
          {textQuestions.map((q) => (
            <div key={q.id} className="rounded-md border border-line bg-surface p-5">
              <label className="text-sm text-ink" htmlFor={q.id}>
                {q.question} <span className="text-ink-faint">(facultatif)</span>
              </label>
              <textarea
                id={q.id}
                rows={3}
                className="mt-3 w-full rounded-sm border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none"
                placeholder="Votre réponse…"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={!allScaleAnswered}
            className="rounded-sm bg-amber px-6 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            Envoyer et débloquer l&apos;examen
          </button>
        </form>
      )}
    </div>
  );
}
