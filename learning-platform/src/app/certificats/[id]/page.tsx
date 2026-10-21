"use client";

import Link from "next/link";
import { use } from "react";
import { useAuth, useCertificates } from "@/lib/providers";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const { certificates, ready } = useCertificates();

  if (loading || !ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-md border border-line bg-surface" aria-busy="true" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-mute">
          Connectez-vous pour consulter ce certificat.{" "}
          <Link href="/connexion" className="text-amber-bright underline underline-offset-4">Se connecter</Link>
        </p>
      </div>
    );
  }

  const cert = certificates.find((c) => c.id === id);
  if (!cert) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-mute">Certificat introuvable sur ce compte.</p>
        <Link href="/certificats" className="mt-4 inline-block text-amber-bright underline underline-offset-4">
          ← Mes certificats
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/certificats" className="text-sm text-ink-mute hover:text-ink">
          ← Mes certificats
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg hover:bg-amber-bright"
        >
          Télécharger en PDF / Imprimer
        </button>
      </div>

      {/* ============ THE CERTIFICATE (print target) ============ */}
      <div
        id="certificate"
        className="overflow-hidden rounded-md border border-line-strong bg-white text-[#14181f] shadow-[var(--tn-shadow-2)] print:rounded-none print:border-0 print:shadow-none"
      >
        {/* header band */}
        <div className="flex items-center justify-between border-b-2 border-[#e8b04b] bg-[#14181f] px-8 py-5">
          <div className="flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="26" height="26" rx="5" fill="#1e242f" stroke="#303948" />
              <line x1="8" y1="6" x2="8" y2="22" stroke="#303948" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="14" y1="6" x2="14" y2="22" stroke="#303948" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="20" y1="6" x2="20" y2="22" stroke="#303948" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="5.4" y="9" width="5.2" height="3.4" rx="1" fill="#e8b04b" />
              <rect x="11.4" y="15" width="5.2" height="3.4" rx="1" fill="#3ddc97" />
              <rect x="17.4" y="11.5" width="5.2" height="3.4" rx="1" fill="#5aa9f2" />
            </svg>
            <span className="font-display text-lg font-semibold text-[#e9edf3]">
              Tech<span className="text-[#e8b04b]"> Nest</span>
            </span>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#9aa4b2]">
            Certificat de réussite
          </p>
        </div>

        <div className="px-8 py-10 sm:px-12">
          <p className="text-center font-mono text-xs uppercase tracking-[0.25em] text-[#8a7433]">
            BTS Métiers de l&apos;audiovisuel · option Métiers du son
          </p>
          <h1 className="mt-6 text-center font-display text-xl text-[#556070]">
            Ce certificat est décerné à
          </h1>
          <p className="mt-3 text-center font-display text-4xl font-bold tracking-tight text-[#14181f]">
            {cert.userName}
          </p>
          <p className="mx-auto mt-6 max-w-lg text-center text-sm leading-relaxed text-[#556070]">
            pour avoir suivi l&apos;intégralité du cours et réussi l&apos;examen final
            (score : <strong className="text-[#14181f]">{Math.round(cert.score * 100)} %</strong>) du cours
          </p>
          <p className="mt-3 text-center font-display text-xl font-semibold text-[#14181f]">
            {cert.courseTitle}
          </p>
          <p className="mt-2 text-center font-mono text-xs text-[#8a7433]">
            Épreuve {cert.epreuveCode} du référentiel officiel · coefficient {cert.coefficient} (arrêté du 4 juin 2013)
          </p>

          {/* competencies */}
          <div className="mx-auto mt-8 max-w-xl rounded-md border border-[#e4e0d3] bg-[#faf8f2] p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a7433]">
              Compétences démontrées — RNCP37196
            </p>
            <ul className="mt-3 space-y-2">
              {cert.blocs.map((b) => (
                <li key={b.rncp} className="text-sm text-[#38404c]">
                  <span className="font-mono text-xs text-[#8a7433]">{b.rncp}</span> — {b.intitule}
                </li>
              ))}
              {cert.competencies.map((c) => (
                <li key={c} className="text-sm text-[#38404c]">• {c}</li>
              ))}
            </ul>
          </div>

          {/* footer row */}
          <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-[#e4e0d3] pt-6">
            <div className="text-xs leading-relaxed text-[#556070]">
              <p>Délivré le <strong className="text-[#14181f]">{formatDate(cert.issuedAt)}</strong></p>
              <p>Valable 3 ans — jusqu&apos;au <strong className="text-[#14181f]">{formatDate(cert.expiresAt)}</strong></p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a7433]">
                Code de vérification
              </p>
              <p className="mt-1 rounded-sm border border-[#e4e0d3] bg-[#faf8f2] px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-[#14181f]">
                {cert.verificationCode}
              </p>
            </div>
          </div>
          <p className="mt-6 text-center font-mono text-[10px] leading-relaxed text-[#98a0ac]">
            Certificat Tech Nest — attestation pédagogique indépendante, non délivrée par le ministère de
            l&apos;Éducation nationale. Vérifiable sur technest.fr/verification.
          </p>
        </div>
      </div>

      <p className="no-print mt-6 text-center text-xs text-ink-faint">
        Astuce : « Télécharger en PDF » ouvre l&apos;impression du navigateur — choisissez
        « Enregistrer au format PDF » comme destination.
      </p>
    </div>
  );
}
