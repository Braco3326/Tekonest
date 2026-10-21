import type { AnnaleEntry } from "./types";

/**
 * Index des annales officielles et ressources — seeded 1:1 from
 * db_annales_index.csv (compiled from éduscol STI & education.gouv, July 2026).
 * `official` = published by éduscol / education.gouv.
 */
export const ANNALES: AnnaleEntry[] = [
  {
    session: "2025",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/18320/18320-25mvptess-sujet-1_0.pdf",
    official: true,
  },
  {
    session: "2024",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel (page)",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/concours_examens/epreuve-e3-bts-mav-metiers-du-son-session-2024",
    official: true,
  },
  {
    session: "2023",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/15926/15926-bts-ma-ms-2023-ptes-sujet.pdf",
    official: true,
  },
  {
    session: "2022",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/14645/14645-bts-ma-ms-2022-ptes-sujet.pdf",
    official: true,
  },
  {
    session: "2021",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/13531/13531-mvptess-2021-sujet.pdf",
    official: true,
  },
  {
    session: "2020",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/12540/12540-epreuve-e3-bts-mav-son-sujet-ptes-sujet.pdf",
    official: true,
  },
  {
    session: "2019",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/11209/11209-epreuve-e3-bts-mav-son-sujet-ptes.pdf",
    official: true,
  },
  {
    session: "2017",
    epreuve: "E3 PTES",
    unite: "U3",
    option: "Son",
    type: "Sujet",
    statut: "Officiel (page)",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/concours_examens/epreuve-e3-bts-mav-metiers-du-son-session-2017",
    official: true,
  },
  {
    session: "Sujet 0",
    epreuve: "E3 PTES + toutes options",
    unite: "U3",
    option: "Toutes",
    type: "Sujet 0",
    statut: "Officiel (page)",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/concours_examens/bts-mav-sujets-0",
    official: true,
  },
  {
    session: "2024",
    epreuve: "E1 CAA",
    unite: "U1",
    option: "Commun",
    type: "Sujet",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/17184/17184-24mvcaa-sujet.pdf",
    official: true,
  },
  {
    session: "2022",
    epreuve: "E1 CAA",
    unite: "U1",
    option: "Commun",
    type: "Corrigé",
    statut: "Officiel PDF",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/concours-examens/14956/14956-culture-audiovisuelle-et-artistique-2022-elements-de-correction-candidat-non-ccf.pdf",
    official: true,
  },
  {
    session: "Sujet 0",
    epreuve: "E1 CAA",
    unite: "U1",
    option: "Commun",
    type: "Sujet 0",
    statut: "Officiel (page)",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/concours_examens/domaine-litteraire-et-artistique-culture-audiovisuelle-et-artistique-sujet-0",
    official: true,
  },
  {
    session: "2024",
    epreuve: "Thème CAA",
    unite: "U1",
    option: "Commun",
    type: "Note BO",
    statut: "Officiel",
    source: "education.gouv",
    lien: "https://www.education.gouv.fr/bo/22/Hebdo33/ESRS2224338N.htm",
    official: true,
  },
  {
    session: "2025",
    epreuve: "Thème CAA",
    unite: "U1",
    option: "Commun",
    type: "Note BO",
    statut: "Officiel",
    source: "education.gouv",
    lien: "https://www.education.gouv.fr/bo/2023/Hebdo30/ESRS2315469N",
    official: true,
  },
  {
    session: "2026",
    epreuve: "Thème CAA",
    unite: "U1",
    option: "Commun",
    type: "Note BO",
    statut: "Officiel",
    source: "education.gouv",
    lien: "https://www.education.gouv.fr/bo/2024/Hebdo27/ESRS2416038N",
    official: true,
  },
  {
    session: "2011-2025",
    epreuve: "E1/E2 (CGE/LV/maths)",
    unite: "U1/U2",
    option: "Commun",
    type: "Sujets + corrigés",
    statut: "Tiers (non officiel)",
    source: "btsmav.fr",
    lien: "https://btsmav.fr/annales-sujets-et-corriges",
    official: false,
  },
  {
    session: "Multi",
    epreuve: "Toutes épreuves (par session)",
    unite: "Toutes",
    option: "Toutes",
    type: "Hub",
    statut: "Officiel",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/concours_examens/bts-mav-session-2025",
    official: true,
  },
  {
    session: "Multi",
    epreuve: "Formation (hub)",
    unite: "Toutes",
    option: "Toutes",
    type: "Hub",
    statut: "Officiel",
    source: "éduscol STI",
    lien: "https://sti.eduscol.education.fr/formations/bts/bts-metiers-de-laudiovisuel-mav",
    official: true,
  },
];

/** URL-safe slug for one annale entry — stable and unique across the index. */
export function annaleSlug(a: AnnaleEntry): string {
  const base = `${a.epreuve} ${a.type} ${a.session}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Guard against theoretical duplicates by suffixing the index position.
  const dupes = ANNALES.filter(
    (x) => x.epreuve === a.epreuve && x.type === a.type && x.session === a.session
  );
  if (dupes.length > 1) {
    return `${base}-${ANNALES.indexOf(a) + 1}`;
  }
  return base;
}

export function getAnnaleBySlug(slug: string): AnnaleEntry | undefined {
  return ANNALES.find((a) => annaleSlug(a) === slug);
}
