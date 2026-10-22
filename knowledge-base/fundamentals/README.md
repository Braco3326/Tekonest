# Fondamentaux du son (How sound works): source map

These 19 sourced explainer files are written in French with the English technical terms. They are the source map for the Tekonest learning-platform course steps. Each file has the same structure: frontmatter with BTS mapping and TekPractice rules, then En bref, Notions clés, Formules, Erreurs fréquentes, Lien avec le matériel, Pour aller plus loin, and numbered Sources.

| # | Fichier | Sujet | Sources | Règles TekPractice |
|---|---|---|---|---|
| 01 | [01-acoustique-ondes-sonores.md](01-acoustique-ondes-sonores.md) | Acoustique et ondes sonores | 8 | — |
| 02 | [02-decibels-gain-staging.md](02-decibels-gain-staging.md) | Décibels, niveaux de référence, gain staging | 12 | R2 |
| 03 | [03-frequence-harmoniques-audition.md](03-frequence-harmoniques-audition.md) | Fréquence, harmoniques, audition | 15 | — |
| 04 | [04-microphones-principes-directivite.md](04-microphones-principes-directivite.md) | Microphones : transduction et directivité | 10 | R4 |
| 05 | [05-alimentation-fantome.md](05-alimentation-fantome.md) | Alimentation fantôme | 8 | R4 |
| 06 | [06-lignes-symetriques-asymetriques.md](06-lignes-symetriques-asymetriques.md) | Lignes symétriques / asymétriques | 10 | R1, R2 |
| 07 | [07-impedance.md](07-impedance.md) | Impédance | 16 | R2 |
| 08 | [08-console-chemin-du-signal.md](08-console-chemin-du-signal.md) | Console : chemin du signal | 3 | — |
| 09 | [09-ecoute-retours-mix-minus.md](09-ecoute-retours-mix-minus.md) | Écoute, retours, mix-minus (N-1) | 7 | R6, R7 |
| 10 | [10-audionumerique.md](10-audionumerique.md) | Audionumérique, horloge | 9 | R8 |
| 11 | [11-reseaux-audio.md](11-reseaux-audio.md) | Réseaux audio (Dante, AES67, Milan, MADI) | 8 | R8 |
| 12 | [12-larsen-feedback.md](12-larsen-feedback.md) | Effet Larsen | 12 | R6 |
| 13 | [13-acoustique-des-salles.md](13-acoustique-des-salles.md) | Acoustique des salles | 7 | — |
| 14 | [14-diffusion-amplification-calage.md](14-diffusion-amplification-calage.md) | Diffusion, amplification, calage | 12 | — |
| 15 | [15-workflow-sonorisation-live.md](15-workflow-sonorisation-live.md) | Workflow live | 5 | — |
| 16 | [16-workflow-enregistrement-studio.md](16-workflow-enregistrement-studio.md) | Workflow studio | 8 | — |
| 17 | [17-workflow-radio-broadcast.md](17-workflow-radio-broadcast.md) | Workflow radio / broadcast | 7 | R5, R6, R7 |
| 18 | [18-workflow-post-production.md](18-workflow-post-production.md) | Workflow post-production | 7 | — |
| 19 | [19-securite.md](19-securite.md) | Sécurité (audition, électricité, accroche) | 13 | — |

The source counts are approximate (numbered entries in each Sources section). The rule column is indicative; each file's frontmatter `tekpractice_rules` is authoritative.

## BTS mapping status

**No savoir code is verified.** The official référentiel PDF and the eduscol STI pages refused every connection during this run (ECONNRESET, from both the research agents and the orchestrator). Every `bts_mapping` entry is therefore `verified: false` with a one-line reason. The épreuve codes (E3 PTES, E4) and bloc BC02 come from `learning-platform/src/data/referentiel.ts` and the France Compétences RNCP37196 record. See `../OPEN_QUESTIONS.md`.

## Discrepancies found with existing course content (not edited)

- `learning-platform/src/data/courses/e3/unit1-acoustique.ts` states "EBU R68 : +4 dBu ↔ −18 dBFS". EBU R 68 is a digital alignment recommendation. EBU Tech 3276 and ITU-R BS.645 give the analogue alignment as 0 dBu ↔ −18 dBFS. See 02-decibels-gain-staging.md.
- `unit3-transducteurs.ts` gives null angles of 126° (supercardioid) and 110° (hypercardioid). DPA Mic University gives different rounded values. The sources differ; see 04-microphones-principes-directivite.md.
