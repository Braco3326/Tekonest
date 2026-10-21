import type { Metadata } from "next";
import { LearningPath } from "@/components/LearningPath";
import { TOTAL_COEFFICIENTS } from "@/data/referentiel";

export const metadata: Metadata = {
  title: "Parcours & cours — BTS Audiovisuel option Son",
  description:
    "Le parcours d'apprentissage complet du BTS MAV option Métiers du son : un cours par épreuve (E1–E6), avec les vrais coefficients du référentiel officiel. Cours E3 PTES complet et gratuit.",
};

export default function CoursesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Le parcours BTS Son
        </h1>
        <p className="mt-4 leading-relaxed text-ink-mute">
          Un cours par épreuve du règlement d&apos;examen (arrêté du 4 juin 2013), avec son
          coefficient réel — total obligatoire : {TOTAL_COEFFICIENTS}. Le bloc technique
          E3 → E4 → E51 (coefficients 4+4+4) forme la colonne vertébrale du parcours ;
          commencez par le cours complet <strong className="text-ink">E3 · PTES</strong>.
        </p>
      </header>
      <div className="mt-12">
        <LearningPath />
      </div>
    </div>
  );
}
