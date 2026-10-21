"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAllProgress, useAuth, useCertificates } from "@/lib/providers";
import { COURSES } from "@/data/courses";
import { courseCompletion } from "@/lib/progress/model";

export default function ProfilePage() {
  const { user, loading, logOut, updateProfile } = useAuth();
  const { all } = useAllProgress();
  const { certificates } = useCertificates();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (loading) {
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
          Connectez-vous pour accéder à votre profil.{" "}
          <Link href="/connexion" className="text-amber-bright underline underline-offset-4">Se connecter</Link>
        </p>
      </div>
    );
  }

  const activeCourses = COURSES.filter((c) => c.status === "available");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber font-display text-xl font-bold text-bg">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{user.name}</h1>
          <p className="font-mono text-xs text-ink-faint">
            {user.email} · membre depuis le{" "}
            {new Date(user.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      {/* stats */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-surface p-4 text-center">
          <p className="font-mono text-2xl font-bold text-ink">{certificates.length}</p>
          <p className="mt-1 text-xs text-ink-faint">certificat{certificates.length > 1 ? "s" : ""} obtenu{certificates.length > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-md border border-line bg-surface p-4 text-center">
          <p className="font-mono text-2xl font-bold text-ink">
            {activeCourses.filter((c) => courseCompletion(c, all[c.id] ?? { courseId: c.id, units: {}, examAttempts: [] }) > 0).length}
          </p>
          <p className="mt-1 text-xs text-ink-faint">cours commencé(s)</p>
        </div>
        <div className="rounded-md border border-line bg-surface p-4 text-center">
          <p className="font-mono text-2xl font-bold text-ink">
            {Math.round(
              (activeCourses.reduce(
                (acc, c) => acc + courseCompletion(c, all[c.id] ?? { courseId: c.id, units: {}, examAttempts: [] }),
                0
              ) /
                Math.max(activeCourses.length, 1)) *
                100
            )}
            <span className="text-sm"> %</span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">progression moyenne</p>
        </div>
      </div>

      {/* edit name */}
      <form
        className="mt-10 rounded-md border border-line bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name && name.trim()) {
            await updateProfile({ name: name.trim() });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }}
      >
        <label htmlFor="profile-name" className="block text-sm font-medium text-ink">
          Nom affiché sur les certificats
        </label>
        <p className="mt-1 text-xs text-ink-faint">
          Modifie le nom des futurs certificats (les certificats déjà émis ne changent pas).
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="profile-name"
            value={name ?? user.name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-sm border border-line bg-bg px-3.5 py-2 text-sm text-ink focus:border-amber focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-sm border border-line-strong bg-raised px-4 py-2 text-sm text-ink hover:bg-overlay"
          >
            {saved ? "✓ Enregistré" : "Enregistrer"}
          </button>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/certificats"
          className="rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm text-ink hover:bg-overlay"
        >
          Mes certificats
        </Link>
        <button
          onClick={async () => {
            await logOut();
            router.push("/");
          }}
          className="rounded-sm border border-clip bg-clip-dim px-5 py-2.5 text-sm text-clip hover:opacity-80"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
