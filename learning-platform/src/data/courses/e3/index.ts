import type { Course } from "../../types";
import { unitAcoustique } from "./unit1-acoustique";
import { unitElectricite } from "./unit2-electricite";
import { unitTransducteurs } from "./unit3-transducteurs";
import { unitAudionumerique } from "./unit4-audionumerique";
import { unitTraitement } from "./unit5-traitement";
import { unitSupports } from "./unit6-supports";
import { e3Exam } from "./exam";

/**
 * E3 — Physique et technique des équipements et supports (PTES).
 * The one Son-specific written épreuve with public official annales
 * (éduscol, 2017–2025) — the fully-built Tech Nest course.
 */
export const e3Course: Course = {
  id: "e3-ptes",
  slug: "e3-ptes",
  title: "Physique et technique des équipements et supports (PTES)",
  shortTitle: "PTES",
  description:
    "Le cœur scientifique de l'option Son : acoustique, électricité du signal audio, transducteurs, audionumérique, traitement du signal et chaînes d'équipements. Prépare l'épreuve écrite E3 (coefficient 4, 6 h) — la seule épreuve écrite spécifique Son avec annales officielles publiques.",
  epreuve: "E3",
  blocs: ["BC02"],
  competencies: [
    "Maîtrise des principes physiques du signal audio (acoustique, électricité, audionumérique)",
    "Analyse et choix des équipements et supports d'une chaîne son",
    "Mise en œuvre des savoir-faire des métiers du son (RNCP37196BC02)",
  ],
  status: "available",
  prerequisites: [],
  pathOrder: 1,
  units: [
    unitAcoustique,
    unitElectricite,
    unitTransducteurs,
    unitAudionumerique,
    unitTraitement,
    unitSupports,
  ],
  survey: [
    { id: "sv-clarity", kind: "scale", question: "Les leçons étaient claires et bien structurées." },
    { id: "sv-difficulty", kind: "scale", question: "Le niveau de difficulté était adapté à la préparation de l'E3." },
    { id: "sv-examples", kind: "scale", question: "Les exemples chiffrés (exercices résolus) m'ont aidé·e à comprendre." },
    { id: "sv-quiz", kind: "scale", question: "Les quiz reflétaient bien le contenu des leçons." },
    { id: "sv-confidence", kind: "scale", question: "Je me sens plus confiant·e pour l'épreuve E3." },
    { id: "sv-missing", kind: "text", question: "Quelles notions auraient mérité plus de détails ?" },
    { id: "sv-feedback", kind: "text", question: "Une remarque pour améliorer ce cours ?" },
  ],
  exam: e3Exam,
};
