import type { Course } from "../types";
import { e3Course } from "./e3";

/**
 * The course catalog. One course per épreuve of the BTS MAV option Son.
 * E3/PTES is fully built; the others are honest stubs ("en préparation")
 * with real référentiel metadata only.
 *
 * Learning-path prerequisites are a Tech Nest pedagogical recommendation
 * (logged assumption — not from the référentiel): the technical core
 * E3 → E4 → E51 builds on itself; the other épreuves are independent.
 */

const stubSurvey = () => [];

export const COURSES: Course[] = [
  {
    id: "e1-caa",
    slug: "e1-culture-audiovisuelle",
    title: "Culture audiovisuelle et artistique",
    shortTitle: "CAA",
    description:
      "Analyse d'œuvres, histoire des arts et du son au cinéma, thème national annuel. Prépare l'épreuve écrite E1 (coefficient 2).",
    epreuve: "E1",
    blocs: ["BC04"],
    competencies: ["Analyse de situation professionnelle appliquée aux œuvres audiovisuelles"],
    status: "stub",
    prerequisites: [],
    pathOrder: 2,
    stubNote:
      "Ce cours suivra le thème national annuel publié au Bulletin officiel. En préparation.",
    units: [],
    survey: stubSurvey(),
    exam: null,
  },
  {
    id: "e2-anglais",
    slug: "e2-anglais",
    title: "Anglais technique de l'audiovisuel",
    shortTitle: "Anglais",
    description:
      "Vocabulaire technique du son en anglais, compréhension de documentation constructeur, préparation à l'oral E2 (coefficient 1).",
    epreuve: "E2",
    blocs: ["BC03"],
    competencies: ["Communication professionnelle en anglais"],
    status: "stub",
    prerequisites: [],
    pathOrder: 6,
    stubNote: "En préparation — entraînement oral avec IA prévu.",
    units: [],
    survey: stubSurvey(),
    exam: null,
  },
  e3Course,
  {
    id: "e4-tmo",
    slug: "e4-techniques-mise-en-oeuvre",
    title: "Techniques et mise en œuvre",
    shortTitle: "TMO",
    description:
      "Prise de son, mixage, sonorisation, configuration des équipements : la pratique du métier. Prépare l'épreuve pratique E4 (coefficient 4).",
    epreuve: "E4",
    blocs: ["BC02", "BC03"],
    competencies: [
      "Mise en œuvre des savoir-faire des métiers du son",
      "Participation à une production audiovisuelle",
    ],
    status: "stub",
    prerequisites: ["e3-ptes"],
    pathOrder: 3,
    stubNote:
      "Bientôt : le Simulateur Audio Tech Nest s'intégrera ici — câbler de vrais équipements (consoles, boîtiers de scène, patchbays) en 3D et apprendre des erreurs classiques (fantôme, larsen, N-1, horloge). En préparation.",
    units: [],
    survey: stubSurvey(),
    exam: null,
  },
  {
    id: "e51-projet",
    slug: "e51-projet-industriel",
    title: "Projet à caractère industriel",
    shortTitle: "Projet",
    description:
      "Conduite de projet son en équipe, revues de production, soutenance orale. Prépare l'épreuve E51 (coefficient 4).",
    epreuve: "E51",
    blocs: ["BC01"],
    competencies: ["Mise en place d'un projet"],
    status: "stub",
    prerequisites: ["e4-tmo"],
    pathOrder: 4,
    stubNote: "En préparation — assistant de cadrage de dossier et simulation de revues de production prévus.",
    units: [],
    survey: stubSurvey(),
    exam: null,
  },
  {
    id: "e52-eej",
    slug: "e52-environnement-economique-juridique",
    title: "Environnement économique et juridique",
    shortTitle: "Éco & droit",
    description:
      "Droit d'auteur, droits voisins, statuts (intermittence), économie de la production audiovisuelle. Prépare l'oral E52 (coefficient 1).",
    epreuve: "E52",
    blocs: ["BC01"],
    competencies: ["Mise en place d'un projet — dimension économique et juridique"],
    status: "stub",
    prerequisites: [],
    pathOrder: 5,
    stubNote: "En préparation.",
    units: [],
    survey: stubSurvey(),
    exam: null,
  },
  {
    id: "e6-milieu-pro",
    slug: "e6-milieu-professionnel",
    title: "Situation en milieu professionnel",
    shortTitle: "Stage",
    description:
      "Préparer le stage de fin de 1re année (8 à 10 semaines), construire le dossier et réussir l'oral E6 (coefficient 1).",
    epreuve: "E6",
    blocs: ["BC04"],
    competencies: ["Analyse de situation professionnelle"],
    status: "stub",
    prerequisites: [],
    pathOrder: 7,
    stubNote: "En préparation — chercheur de stages/alternances prévu.",
    units: [],
    survey: stubSurvey(),
    exam: null,
  },
];

export function getCourseBySlug(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function getCourseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export const LEARNING_PATH = [...COURSES].sort((a, b) => a.pathOrder - b.pathOrder);
