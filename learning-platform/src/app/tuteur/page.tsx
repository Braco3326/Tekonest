import type { Metadata } from "next";
import { TutorPanel } from "@/components/TutorPanel";

export const metadata: Metadata = {
  title: "Tuteur IA",
  description:
    "Le tuteur IA de Tech Nest : un assistant socratique ancré dans le cours E3/PTES et le référentiel officiel du BTS Métiers du Son. Il guide, il ne donne pas les réponses.",
};

export default async function TuteurPage({
  searchParams,
}: {
  searchParams: Promise<{ unite?: string }>;
}) {
  const { unite } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wide text-amber">Assistant</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Tuteur IA</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mute">
          Un tuteur socratique, ancré exclusivement dans le contenu du cours E3/PTES, le référentiel
          officiel et l&apos;index des annales. Il cite ses sources, admet ce qu&apos;il ne sait pas, et ne
          donne jamais la réponse d&apos;une question d&apos;évaluation — il vous y amène.
        </p>
      </div>
      <TutorPanel initialUnitSlug={unite} />
      <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink-faint">
        Le tuteur peut se tromper : vérifiez les points importants dans le cours et les textes officiels.
        Vos échanges ne sont pas enregistrés côté serveur.
      </p>
    </main>
  );
}
