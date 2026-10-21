"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/providers";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const { signUp, logIn } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(name, email);
      } else {
        await logIn(email);
      }
      router.push("/cours");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
        {mode === "signup" ? "Créer un compte" : "Connexion"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-mute">
        {mode === "signup"
          ? "Gratuit. Votre compte conserve votre progression et vos certificats."
          : "Retrouvez votre progression et vos certificats."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
              Nom complet
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom (tel qu'il figurera sur vos certificats)"
              className="w-full rounded-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className="w-full rounded-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none"
          />
        </div>
        {error && (
          <p className="rounded-sm border border-clip bg-clip-dim px-3 py-2 text-sm text-clip" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-amber-bright disabled:opacity-50"
        >
          {mode === "signup" ? "Créer mon compte gratuit" : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-mute">
        {mode === "signup" ? (
          <>Déjà un compte ? <Link href="/connexion" className="text-amber-bright underline underline-offset-4">Se connecter</Link></>
        ) : (
          <>Pas encore de compte ? <Link href="/inscription" className="text-amber-bright underline underline-offset-4">S&apos;inscrire</Link></>
        )}
      </p>
      <p className="mt-8 rounded-md border border-line bg-surface p-3 text-center font-mono text-[11px] leading-relaxed text-ink-faint">
        Version bêta : compte local à ce navigateur (pas de mot de passe, aucune donnée
        envoyée à un serveur).
      </p>
    </div>
  );
}
