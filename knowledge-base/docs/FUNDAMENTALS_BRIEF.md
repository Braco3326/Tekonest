# Fundamentals agent brief (Phase 4)

Repo root `C:\Users\brro\dev\Tekonest`. Write ONLY your assigned files in `knowledge-base/fundamentals/`. Do not run git and do not edit other files.

Audience: French BTS MAV option Son students (two-year post-bac programme) and the Tekonest learning website's course writers. These files are the SOURCE MAP the course steps will be written from, so they must be accurate and traceable.

## File template (Markdown, one file per topic, name `NN-slug.md`)

```markdown
---
id: NN-slug
title_fr: ...
title_en: ...
bts_mapping:            # only the mappings you could verify (see rules)
  - epreuve: E3         # E1..E6 / U-units from the règlement d'examen
    bloc: BC02          # RNCP37196 blocs if applicable
    savoirs: "S... (code + label as written in the référentiel)"   # or "not verified"
    verified: true|false
    source: <url>
tekpractice_rules: [R4]  # TekPractice rules R1-R8 this topic underpins, if any
last_checked: 2026-10-22
---

# <Titre FR> (<English title>)

## En bref / In short
3-5 sentences in French. Key English technical terms appear in parentheses on first use.

## Notions clés (Key concepts)
Bullets. French first, (English term).

## Formules (Formulas)
Only formulas you verified in a cited source. For each one: formula, variables with units, a one-line meaning, and [source n].
Example form: L_p = 20·log10(p / p0), p0 = 20 µPa [2]

## Erreurs fréquentes (Common mistakes)
Bullets with the correct practice.

## Lien avec le matériel (Equipment links)
Device ids from `knowledge-base/equipment/*.json` where relevant (the files may still be in progress; only cite ids that exist when you check, otherwise skip), and TekPractice rule ids.

## Pour aller plus loin (Best sources)
Annotated list: what each source is good for.

## Sources
1. Title, publisher, URL, accessed 2026-10-22, confidence (verified-primary / verified-secondary / unverified)
```

## Rules
1. Every URL must have appeared in your own WebSearch/WebFetch results this session. Never write URLs from memory.
2. Each formula and numerical claim must be supported by a numbered source. Preferred sources: AES, EBU (Tech docs and R 128 are free), ITU-R (BS.1770, BS.775 are free PDFs), IEC pages, manufacturer education pages (Shure, Sennheiser, Neumann, DPA Mic University, Audio-Technica, Yamaha, Audinate, Meyer Sound, L-Acoustics, d&b, Rane notes), official French sources (eduscol, legifrance for safety rules like décret 2017-1244 on amplified sound, INRS for hearing/electrical safety), university course pages, and reputable textbooks (cite them as books with publisher; do not quote them at length).
3. BTS mapping: use only the épreuves listed in `learning-platform/src/data/referentiel.ts` (E1, E2, E3 PTES, E4 Techniques et mise en œuvre, E51, E52, E6) and blocs BC01–BC04. To cite a specific savoir code (S-codes or similar), you must have read it in the official référentiel PDF (`https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf`) or another official eduscol/education.gouv.fr page during this session. If you cannot, set `verified: false` with `savoirs: "not verified"` and explain in one line why you think the épreuve applies.
4. Write in your own words. No long quotations; short definitions are fine with attribution.
5. Bilingual: French is the main language, with the English technical terms. Keep each file focused, at roughly 600-1500 words.
6. Finish by checking that every file has its frontmatter and a Sources section, and that each [n] reference exists. Reply with a report under 200 words: files written, number of sources, which BTS mappings were verified vs not, and gaps.
