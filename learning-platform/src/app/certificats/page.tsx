"use client";

import Link from "next/link";
import { useAuth, useCertificates } from "@/lib/providers";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CertificatesPage() {
  const { user, loading } = useAuth();
  const { certificates, ready } = useCertificates();

  if (loading || !ready) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-60 animate-pulse rounded-md border border-line bg-surface" aria-busy="true" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Mes certificats</h1>
        <p className="mt-3 text-ink-mute">
          Connectez-vous pour retrouver et re-télécharger vos certificats à tout moment.
        </p>
        <Link
          href="/connexion"
          className="mt-6 inline-block rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg hover:bg-amber-bright"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Mes certificats</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-ink-mute">
        Chaque certificat est nominatif, valable 3 ans et porte un code de vérification
        unique. Vous pouvez le re-télécharger ici à tout moment.
      </p>

      {certificates.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-display text-lg font-semibold text-ink">Aucun certificat pour l&apos;instant</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-mute">
            Terminez un cours (unités + enquête) puis réussissez l&apos;examen final avec au
            moins 70 % pour obtenir votre premier certificat.
          </p>
          <Link
            href="/cours/e3-ptes"
            className="mt-6 inline-block rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg hover:bg-amber-bright"
          >
            Commencer E3 · PTES
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {certificates.map((cert) => {
            const expired = new Date(cert.expiresAt) < new Date();
            return (
              <li key={cert.id}>
                <Link
                  href={`/certificats/${cert.id}`}
                  className="block rounded-md border border-line bg-surface p-5 transition-colors hover:border-amber"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-amber">Épreuve {cert.epreuveCode} · coefficient {cert.coefficient}</p>
                      <h2 className="mt-1 font-display text-lg font-semibold text-ink">{cert.courseTitle}</h2>
                      <p className="mt-1 font-mono text-[11px] text-ink-faint">
                        délivré le {formatDate(cert.issuedAt)} · valable jusqu&apos;au {formatDate(cert.expiresAt)} · code {cert.verificationCode}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] ${expired ? "bg-clip-dim text-clip" : "bg-signal-dim text-signal"}`}>
                        {expired ? "expiré" : `${Math.round(cert.score * 100)} % · valide`}
                      </span>
                      <span className="text-sm font-medium text-amber-bright">Ouvrir →</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
