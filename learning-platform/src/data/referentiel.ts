import type { BlocCompetences, Epreuve } from "./types";

/**
 * Règlement d'examen — BTS Métiers de l'audiovisuel, option Métiers du son.
 * Source : arrêté du 4 juin 2013 (Annexe IV), modifié 2014/2016.
 * Seeded 1:1 from db_epreuves_coefficients.csv — do not edit values here
 * without checking the official texts.
 */
export const EPREUVES: Epreuve[] = [
  {
    code: "E1",
    unite: "U1",
    titre: "Culture audiovisuelle et artistique (CAA)",
    coefficient: 2,
    formeCCF: "CCF, 2 situations",
    formePonctuelle: "Ponctuelle écrite",
    duree: "4 h (4h30 avec visionnement)",
    notes: "Thème national annuel",
  },
  {
    code: "E2",
    unite: "U2",
    titre: "Anglais",
    coefficient: 1,
    formeCCF: "CCF, 2 situations",
    formePonctuelle: "Ponctuelle orale",
    duree: "45 min",
    notes: "Oral — pas de sujet écrit national",
  },
  {
    code: "E3",
    unite: "U3",
    titre: "Physique et technique des équipements et supports (PTES)",
    coefficient: 4,
    formeCCF: "Ponctuelle écrite",
    formePonctuelle: "Ponctuelle écrite",
    duree: "6 h (3h+3h)",
    notes: "Épreuve écrite spécifique Son — annales publiques",
  },
  {
    code: "E4",
    unite: "U4",
    titre: "Techniques et mise en œuvre",
    coefficient: 4,
    formeCCF: "CCF, 2 situations",
    formePonctuelle: "Ponctuelle pratique",
    duree: "4 h (+30 min prépa)",
    notes: "Pratique — pas de sujet public",
  },
  {
    code: "E51",
    unite: "U51",
    titre: "Projet à caractère industriel",
    coefficient: 4,
    formeCCF: "Ponctuelle orale",
    formePonctuelle: "Ponctuelle orale",
    duree: "45 min (1 h libre)",
    notes: "2 pts issus de 2 revues de production",
  },
  {
    code: "E52",
    unite: "U52",
    titre: "Environnement économique et juridique du projet",
    coefficient: 1,
    formeCCF: "Ponctuelle orale",
    formePonctuelle: "Ponctuelle orale",
    duree: "15 min",
  },
  {
    code: "E6",
    unite: "U6",
    titre: "Situation en milieu professionnel",
    coefficient: 1,
    formeCCF: "Ponctuelle orale",
    formePonctuelle: "Ponctuelle orale",
    duree: "30 min",
    notes: "Dossier de stage",
  },
];

/** Total des coefficients obligatoires (2+1+4+4+4+1+1). */
export const TOTAL_COEFFICIENTS = 17;

/**
 * Blocs de compétences — RNCP37196 (France Compétences).
 * Seeded 1:1 from db_blocs_competences.csv.
 */
export const BLOCS: BlocCompetences[] = [
  {
    code: "BC01",
    rncp: "RNCP37196BC01",
    intitule: "Mise en place d'un projet",
    nature: "Commun famille audiovisuel",
  },
  {
    code: "BC02",
    rncp: "RNCP37196BC02",
    intitule: "Mise en œuvre des savoir-faire des métiers du son",
    nature: "Spécifique option Son",
  },
  {
    code: "BC03",
    rncp: "RNCP37196BC03",
    intitule: "Participation à une production audiovisuelle",
    nature: "Commun",
  },
  {
    code: "BC04",
    rncp: "RNCP37196BC04",
    intitule: "Analyse de situation professionnelle",
    nature: "Commun",
  },
];

export function getEpreuve(code: string): Epreuve | undefined {
  return EPREUVES.find((e) => e.code === code);
}

export function getBloc(code: string): BlocCompetences | undefined {
  return BLOCS.find((b) => b.code === code);
}

/** Grille horaire — Annexe III (option Son). Seeded from db_grille_horaire.csv. */
export const GRILLE_HORAIRE = [
  { discipline: "Culture audiovisuelle et artistique", a1: 8, a2: 8, repartition: "6+2+0", global: 240 },
  { discipline: "Anglais", a1: 1.5, a2: 1.5, repartition: "1,5+0+0", global: 45 },
  { discipline: "Sciences physiques", a1: 4, a2: 4, repartition: "2+2+0", global: 120 },
  { discipline: "Économie et gestion", a1: 1.5, a2: 1.5, repartition: "1,5+0+0", global: 45 },
  { discipline: "Technologie des équipements et supports", a1: 5, a2: 5, repartition: "1+0+4", global: 150 },
  { discipline: "Technique et mise en œuvre", a1: 11, a2: 11, repartition: "0+0+11", global: 330 },
] as const;

export const SOURCES_OFFICIELLES = [
  {
    label: "Arrêté du 4 juin 2013 (texte fondateur)",
    url: "https://www.education.gouv.fr/bo/13/Hebdo30/ESRS1312234A.htm",
  },
  {
    label: "Arrêté modificatif du 9 mai 2016",
    url: "https://www.enseignementsup-recherche.gouv.fr/fr/bo/16/Hebdo24/MENS1611607A.htm",
  },
  {
    label: "Fiche RNCP37196 — France Compétences",
    url: "https://www.francecompetences.fr/recherche/rncp/37196/",
  },
  {
    label: "Référentiel BTS MAV — éduscol",
    url: "https://eduscol.education.fr/sti/textes/referentiel-bts-metiers-de-laudiovisuel",
  },
  {
    label: "Référentiel complet (PDF officiel)",
    url: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf",
  },
  {
    label: "Hub annales éduscol STI — BTS MAV",
    url: "https://sti.eduscol.education.fr/concours_examens/bts-mav-session-2025",
  },
] as const;
