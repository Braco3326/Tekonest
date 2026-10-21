/**
 * DRAFT course plans for the stub courses (E1, E2, E52, E6).
 *
 * Status: BROUILLON — à valider par l'expert (voir docs/REVIEW-ME.md §6).
 * Every claim below comes from the verified research files, quoted by source:
 *  - CSV  = db_epreuves_coefficients.csv / db_grille_horaire.csv
 *  - KB   = TechNest_BTS-Son_Knowledge-Base.md (§ indiqué)
 * "hypothèse" marks a name-similarity inference that NO source states
 * explicitly — kept visible on the page as such, never as fact.
 * Full sourced drafts: docs/drafts/plans-cours-stubs.md
 */

export interface DraftTheme {
  title: string;
  source: string;
  hypothesis?: boolean;
}

export interface DraftPlan {
  intro: string;
  themes: DraftTheme[];
  gaps: string[];
}

export const DRAFT_PLANS: Record<string, DraftPlan> = {
  "e1-caa": {
    intro:
      "Les sources vérifiées documentent le format de l'épreuve mais pas le détail du programme. Ce plan se limite donc aux axes justifiables par les sources.",
    themes: [
      { title: "Le thème national annuel (publié chaque année par note au BO)", source: "CSV : « Thème national annuel » · KB §6 (notes BO 2024-2026 indexées)" },
      { title: "Méthodologie de l'épreuve : CCF en 2 situations ou écrit ponctuel de 4 h (4h30 avec visionnement)", source: "CSV : « CCF, 2 situations » / « Ponctuelle écrite, 4 h (4h30 avec visionnement) »" },
      { title: "Entraînement sur les annales officielles E1 CAA (sujets, corrigé 2022, sujet zéro)", source: "KB §6 : annales E1 CAA indexées (éduscol)" },
      { title: "Format cours + travaux dirigés, sans pratique (répartition 6+2+0, 240 h/an)", source: "CSV grille horaire : « 8, 8, 6+2+0, 240 »" },
    ],
    gaps: [
      "Programme détaillé (notions, œuvres, périodes) — absent des sources",
      "Nature exacte des 2 situations de CCF — absent des sources",
      "Attentes méthodologiques de l'écrit (dissertation ? analyse ?) — absent des sources",
    ],
  },
  "e2-anglais": {
    intro:
      "Les sources sont très limitées sur le contenu d'E2 : seuls trois axes sont justifiables. Le reste attend une validation experte.",
    themes: [
      { title: "Entraînement exclusivement oral (aucun sujet écrit national)", source: "CSV : « Oral - pas de sujet écrit national »" },
      { title: "Préparation aux 2 situations du CCF (ou à l'oral ponctuel de 45 min)", source: "CSV : « CCF, 2 situations » / « Ponctuelle orale, 45 min »" },
      { title: "Cadre horaire réduit : 1,5 h/semaine de cours, 45 h/an", source: "CSV grille horaire : « 1.5, 1.5, 1.5+0+0, 45 »" },
    ],
    gaps: [
      "Anglais technique de l'audiovisuel : axe plausible mais mentionné par AUCUNE source — à confirmer",
      "Niveau CECRL visé — absent des sources",
      "Articulation avec l'épreuve facultative EF1 (langue vivante) — non précisée",
    ],
  },
  "e52-eej": {
    intro:
      "L'épreuve la moins documentée des sources (champ « notes » vide dans le règlement indexé). Plan minimal, hypothèses signalées.",
    themes: [
      { title: "Économie et droit appliqués au projet audiovisuel", source: "CSV : intitulé « Environnement économique et juridique du projet »" },
      { title: "Articulation avec le projet E51 (E5 = E51 + E52)", source: "KB §2 : « Décomposée en E51 + E52 »" },
      { title: "Appui sur la discipline « Économie et gestion » (1,5 h/sem, 45 h/an)", source: "CSV grille horaire : « 1.5, 1.5, 1.5+0+0, 45 »", hypothesis: true },
      { title: "Connaissance des secteurs économiques de la filière (production, prestation, diffusion...)", source: "KB §4 : liste des secteurs", hypothesis: true },
    ],
    gaps: [
      "Programme d'économie-gestion (droit d'auteur, statuts, intermittence...) — absent des sources",
      "Déroulé de l'oral de 15 min (dossier ? entretien ?) — absent des sources",
      "Aucune annale publique répertoriée pour E52",
    ],
  },
  "e6-milieu-pro": {
    intro:
      "L'épreuve s'appuie sur le stage de fin de 1re année. Les sources cadrent le format et le contexte professionnel, pas le contenu attendu du dossier.",
    themes: [
      { title: "Méthodologie du dossier de stage (pièce centrale de l'épreuve)", source: "CSV : « Dossier de stage »" },
      { title: "Cadrage du stage : 8 à 10 semaines à temps plein, fin de 1re année", source: "KB §1 : fiche diplôme" },
      { title: "Connaître les métiers et secteurs du son pour analyser sa situation professionnelle", source: "KB §4 : fonctions, métiers visés et secteurs du technicien son" },
      { title: "Préparation à l'oral ponctuel de 30 min", source: "CSV : « Ponctuelle orale, 30 min »" },
    ],
    gaps: [
      "Structure et grille d'évaluation du dossier — absent des sources",
      "Déroulé de l'oral (soutenance ? questions ?) — absent des sources",
      "Aucune annale n'existe « par nature » (KB §6) — entraînement uniquement méthodologique",
    ],
  },
};
