import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-clip">signal perdu · 404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">
        Cette page n&apos;existe pas
      </h1>
      <p className="mt-3 text-ink-mute">
        Le patch est débranché quelque part. Revenez au parcours principal.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-sm bg-amber px-6 py-3 text-sm font-semibold text-bg hover:bg-amber-bright"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
