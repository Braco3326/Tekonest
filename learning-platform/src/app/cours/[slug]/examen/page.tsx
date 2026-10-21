"use client";

import Link from "next/link";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { getCourseBySlug } from "@/data/courses";
import { getBloc, getEpreuve } from "@/data/referentiel";
import { QuizRunner } from "@/components/QuizRunner";
import { useAuth, useCourseProgress } from "@/lib/providers";
import {
  certificateExpiry,
  isCertificateEarned,
  isExamUnlocked,
  makeVerificationCode,
  type Certificate,
} from "@/lib/progress/model";

export default function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const course = getCourseBySlug(slug);
  if (!course || !course.exam) notFound();

  const { user, loading } = useAuth();
  const { progress, ready, actions } = useCourseProgress(course.id);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<{ score: number; passed: boolean } | null>(null);
  const [certId, setCertId] = useState<string | null>(null);

  if (loading || !ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-60 animate-pulse rounded-md border border-line bg-surface" aria-busy="true" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-mute">
          L&apos;examen final nécessite un compte (gratuit) pour délivrer le certificat.{" "}
          <Link href="/inscription" className="text-amber-bright underline underline-offset-4">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    );
  }

  const unlocked = isExamUnlocked(course, progress);
  const alreadyCertified = isCertificateEarned(course, progress);

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-faint">🔒 verrouillé</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
          L&apos;examen final n&apos;est pas encore débloqué
        </h1>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-mute">
          Règle du cours : toutes les unités (leçon + quiz ≥ 70 %) <strong>et</strong>{" "}
          l&apos;enquête de fin de cours doivent être complètes avant l&apos;examen.
        </p>
        <Link
          href={`/cours/${course.slug}`}
          className="mt-6 inline-block rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg hover:bg-amber-bright"
        >
          Voir ce qu&apos;il me reste
        </Link>
      </div>
    );
  }

  async function handleFinish(score: number, passed: boolean) {
    await actions.saveExamAttempt(score, passed);
    if (passed && !progress.certificateId) {
      const epreuve = getEpreuve(course!.epreuve)!;
      const issued = new Date();
      const cert: Certificate = {
        id: `cert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        verificationCode: makeVerificationCode(),
        userName: user!.name,
        userEmail: user!.email,
        courseId: course!.id,
        courseTitle: course!.title,
        epreuveCode: course!.epreuve,
        epreuveTitre: epreuve.titre,
        coefficient: epreuve.coefficient,
        blocs: course!.blocs.map((b) => {
          const bloc = getBloc(b)!;
          return { rncp: bloc.rncp, intitule: bloc.intitule };
        }),
        competencies: course!.competencies,
        score,
        issuedAt: issued.toISOString(),
        expiresAt: certificateExpiry(issued).toISOString(),
      };
      await actions.saveCertificate(cert);
      setCertId(cert.id);
    }
    setFinished({ score, passed });
  }

  const exam = course.exam;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav className="mb-8 font-mono text-xs text-ink-faint" aria-label="Fil d'Ariane">
        <Link href={`/cours/${course.slug}`} className="hover:text-ink-mute">
          {course.epreuve} · {course.shortTitle}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-mute">Examen final</span>
      </nav>

      {!started ? (
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber">Examen final</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
            {course.title}
          </h1>
          <p className="mt-4 leading-relaxed text-ink-mute">{exam.description}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { k: "Questions", v: String(exam.questions.length) },
              { k: "Seuil de réussite", v: `${Math.round(exam.passingScore * 100)} %` },
              { k: "Tentatives", v: "illimitées" },
            ].map((s) => (
              <div key={s.k} className="rounded-md border border-line bg-surface p-4 text-center">
                <p className="font-mono text-2xl font-bold text-ink">{s.v}</p>
                <p className="mt-1 text-xs text-ink-faint">{s.k}</p>
              </div>
            ))}
          </div>
          {alreadyCertified && (
            <p className="mt-4 rounded-md border border-signal bg-signal-dim p-3 text-sm text-signal">
              Vous êtes déjà certifié·e sur ce cours — repasser l&apos;examen est un simple entraînement.
            </p>
          )}
          <button
            onClick={() => setStarted(true)}
            className="mt-8 rounded-sm bg-amber px-6 py-3 text-sm font-semibold text-bg shadow-[var(--tn-shadow-glow-amber)] transition-colors hover:bg-amber-bright"
          >
            Commencer l&apos;examen
          </button>
        </div>
      ) : (
        <>
          <QuizRunner
            questions={exam.questions}
            passThreshold={exam.passingScore}
            title={`Examen final — ${course.shortTitle}`}
            onFinish={handleFinish}
            finishLabel="Terminer l'examen"
          />
          {finished && (
            <div className="mt-8">
              {finished.passed ? (
                <div className="rounded-md border border-signal bg-signal-dim p-6 text-center">
                  <p className="font-display text-xl font-bold text-ink">
                    🎓 Félicitations, votre certificat est délivré
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-mute">
                    Il atteste des compétences démontrées sur l&apos;épreuve {course.epreuve} et
                    reste re-téléchargeable à tout moment depuis « Mes certificats ».
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Link
                      href={certId ? `/certificats/${certId}` : "/certificats"}
                      className="rounded-sm bg-signal px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90"
                    >
                      Voir mon certificat
                    </Link>
                    <Link
                      href="/certificats"
                      className="rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm text-ink hover:bg-overlay"
                    >
                      Mes certificats
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-line bg-surface p-6 text-center">
                  <p className="font-display text-lg font-semibold text-ink">
                    Pas encore — et c&apos;est normal.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-mute">
                    Revoyez les explications ci-dessus, retravaillez les unités les plus
                    fragiles, puis retentez : les tentatives sont illimitées et seul le
                    meilleur score compte.
                  </p>
                  <button
                    onClick={() => {
                      setFinished(null);
                      setStarted(false);
                    }}
                    className="mt-5 rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm text-ink hover:bg-overlay"
                  >
                    Retour à la page d&apos;examen
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
