"use client";

import { useState } from "react";
import { useAuth, useProgressStore } from "@/lib/providers";
import type { Certificate } from "@/lib/progress/model";

/**
 * Certificate verification (mock scope): searches the certificates stored on
 * this browser. The real backend verification endpoint is a named seam in
 * docs/PRODUCT-LATER.md.
 */
export default function VerificationPage() {
  const { user } = useAuth();
  const { store } = useProgressStore();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Certificate | null | "notfound">(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setResult("notfound");
      return;
    }
    const certs = await store.getCertificates(user.id);
    const found = certs.find(
      (c) => c.verificationCode.toUpperCase() === code.trim().toUpperCase()
    );
    setResult(found ?? "notfound");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
        Vérifier un certificat
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-mute">
        Chaque certificat Tech Nest porte un code unique (format <span className="font-mono">TN-XXXX-XXXX</span>).
        Saisissez-le pour vérifier son authenticité et sa validité.
      </p>

      <form onSubmit={verify} className="mt-8 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="TN-XXXX-XXXX"
          aria-label="Code de vérification"
          className="flex-1 rounded-sm border border-line bg-surface px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg hover:bg-amber-bright"
        >
          Vérifier
        </button>
      </form>

      {result === "notfound" && (
        <div className="mt-6 rounded-md border border-clip bg-clip-dim p-4 text-sm text-clip" role="status">
          Aucun certificat trouvé pour ce code sur cet appareil.
          <p className="mt-1 text-xs opacity-80">
            Version bêta : la vérification s&apos;effectue localement, sur les certificats de ce
            navigateur. La vérification publique en ligne arrivera avec les comptes en ligne.
          </p>
        </div>
      )}
      {result && result !== "notfound" && (
        <div className="mt-6 rounded-md border border-signal bg-signal-dim p-5 text-sm" role="status">
          <p className="font-display text-base font-semibold text-signal">✓ Certificat authentique</p>
          <dl className="mt-3 space-y-1.5 text-ink-mute">
            <div><dt className="inline font-medium text-ink">Titulaire : </dt><dd className="inline">{result.userName}</dd></div>
            <div><dt className="inline font-medium text-ink">Cours : </dt><dd className="inline">{result.courseTitle}</dd></div>
            <div><dt className="inline font-medium text-ink">Épreuve : </dt><dd className="inline">{result.epreuveCode} (coefficient {result.coefficient})</dd></div>
            <div><dt className="inline font-medium text-ink">Score : </dt><dd className="inline">{Math.round(result.score * 100)} %</dd></div>
            <div>
              <dt className="inline font-medium text-ink">Validité : </dt>
              <dd className="inline">
                jusqu&apos;au {new Date(result.expiresAt).toLocaleDateString("fr-FR")}{" "}
                {new Date(result.expiresAt) < new Date() ? "(expiré)" : "(valide)"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
