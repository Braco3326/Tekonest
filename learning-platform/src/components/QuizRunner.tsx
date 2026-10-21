"use client";

import { useMemo, useState } from "react";
import type { QuizQuestion } from "@/data/types";
import { quizScore } from "@/lib/progress/model";
import { inline } from "./LessonRenderer";

/**
 * Generic quiz engine — used by unit quizzes AND the final exam.
 * One question at a time, review screen at the end.
 * `onFinish` receives the score as a fraction (0..1).
 */
export function QuizRunner({
  questions,
  passThreshold,
  title,
  onFinish,
  finishLabel = "Voir le résultat",
}: {
  questions: QuizQuestion[];
  passThreshold: number;
  title: string;
  onFinish: (score: number, passed: boolean) => void;
  finishLabel?: string;
}) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const correct = useMemo(() => questions.map((q) => q.answerIndex), [questions]);
  const q = questions[current];
  const isLast = current === questions.length - 1;

  function submitAnswer() {
    if (selected === null) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);
    setSelected(null);
    if (isLast) {
      const score = quizScore(nextAnswers, correct);
      setDone(true);
      onFinish(score, score >= passThreshold);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  if (done) {
    const score = quizScore(answers, correct);
    const passed = score >= passThreshold;
    const nCorrect = Math.round(score * questions.length);
    return (
      <div className="space-y-6">
        <div
          className={`rounded-md border p-6 text-center ${
            passed ? "border-signal bg-signal-dim" : "border-clip bg-clip-dim"
          }`}
        >
          <p className="font-mono text-4xl font-bold text-ink">
            {Math.round(score * 100)}<span className="text-xl"> %</span>
          </p>
          <p className={`mt-2 font-display text-lg font-semibold ${passed ? "text-signal" : "text-clip"}`}>
            {passed ? "Réussi" : "Non validé"}
          </p>
          <p className="mt-1 text-sm text-ink-mute">
            {nCorrect} bonne{nCorrect > 1 ? "s" : ""} réponse{nCorrect > 1 ? "s" : ""} sur {questions.length} — seuil de
            validation : {Math.round(passThreshold * 100)} %.
          </p>
        </div>

        <details className="rounded-md border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 font-display text-sm font-medium text-ink hover:bg-overlay">
            Revoir les {questions.length} questions et les explications
          </summary>
          <ol className="space-y-4 border-t border-line p-4">
            {questions.map((question, i) => {
              const ok = answers[i] === question.answerIndex;
              return (
                <li key={question.id} className="rounded-sm border border-line bg-bg p-4 text-sm">
                  <p className="mb-2 font-medium text-ink">
                    <span className={`mr-2 font-mono ${ok ? "text-signal" : "text-clip"}`}>
                      {ok ? "✓" : "✗"} Q{i + 1}
                    </span>
                    {inline(question.question)}
                  </p>
                  {!ok && (
                    <p className="text-clip">
                      Votre réponse : {question.choices[answers[i]] ?? "—"}
                    </p>
                  )}
                  <p className="text-signal">
                    Bonne réponse : {question.choices[question.answerIndex]}
                  </p>
                  <p className="mt-2 leading-relaxed text-ink-mute">{inline(question.explanation)}</p>
                </li>
              );
            })}
          </ol>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* progress */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-display text-sm font-medium text-ink">{title}</p>
          <p className="font-mono text-xs text-ink-faint">
            {current + 1} / {questions.length}
          </p>
        </div>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={questions.length}>
          {questions.map((_, i) => (
            <div
              key={i}
              className={`flex-1 ${
                i < current
                  ? answers[i] === correct[i]
                    ? "bg-signal"
                    : "bg-clip"
                  : i === current
                    ? "bg-amber"
                    : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      <fieldset className="rounded-md border border-line bg-surface p-5">
        <legend className="sr-only">Question {current + 1}</legend>
        <p className="mb-4 leading-relaxed text-ink">{inline(q.question)}</p>
        <div className="space-y-2">
          {q.choices.map((choice, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 text-sm transition-colors ${
                selected === i
                  ? "border-amber bg-amber-dim text-ink"
                  : "border-line bg-bg text-ink-mute hover:border-line-strong hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name={q.id}
                checked={selected === i}
                onChange={() => setSelected(i)}
                className="mt-0.5 accent-[var(--tn-amber)]"
              />
              <span className="leading-relaxed">{choice}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          onClick={submitAnswer}
          disabled={selected === null}
          className="rounded-sm bg-amber px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLast ? finishLabel : "Question suivante →"}
        </button>
      </div>
    </div>
  );
}
