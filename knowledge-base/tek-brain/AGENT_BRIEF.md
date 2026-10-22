# TEK Brain research agent brief (A2)

You own ONE domain (given in your task). Read `tek-brain/DESIGN.md` §5–§6 first: it defines every field. This brief adds the working rules and full examples.

Repo checkout for this track: `C:\Users\brro\dev\Tekonest-wt\tekbrain` (branch `research/tekbrain`). Write ONLY your domain's files:

```
knowledge-base/tek-brain/concepts/<domain>.json
knowledge-base/tek-brain/skills/<domain>.json
knowledge-base/tek-brain/procedures/<domain>.json
knowledge-base/tek-brain/rules/<domain>.json
knowledge-base/tek-brain/faults/<domain>.json
knowledge-base/tek-brain/scenarios/<domain>.json
knowledge-base/tek-brain/glossary/<domain>.json
```

Never touch other files. Never run git (the lead commits). Keep scratch files in your own scratch subfolder: `C:\Users\brro\AppData\Local\Temp\claude\C--Users-brro\0abcb094-5eae-40a6-b310-8dddc16a4448\scratchpad\<domain>\`.

## Hard rules

1. **Every record has ≥ 1 source you actually opened in this task** (WebFetch result or PDF you read), or a source already cited in `knowledge-base/fundamentals/*.md` / `knowledge-base/equipment/*.json` for that same fact. In the second case, copy the url/publisher/accessed from there and add `"note"` nowhere else; prefer re-opening it when cheap.
2. **Never invent** a spec, formula, standard number, URL, author, regulation, decree number or dimension. If not found: leave it out and add an entry to the file's `not_found_log`.
3. Source priority: manufacturer manual/datasheet/application guide > standards bodies (AES, EBU, ITU-R, IEC, ISO, SMPTE) > official French sources (eduscol, Légifrance, ANFR, ARCEP, INRS, ministère) > university / open courseware > trade press, textbooks > forums (last resort, `confidence: "unverified"`, `kind: "forum"`).
4. `confidence`: `verified-primary` = the publisher is the authority for the fact (manufacturer for its gear, EBU for R128, Légifrance for a decree). `verified-secondary` = reputable but not the authority (Wikipedia citing a standard, trade press, university course). `unverified` = forum/snippet only.
5. **Own words, French first.** No pasting from copyrighted sources; one short quote with citation at most. English technical term in parentheses on first use: « la diaphonie (crosstalk) ».
6. **Formulas**: only if the formula appears in a source you list; `source_url` must equal one of the record's `sources[].url`.
7. **Conflicts**: if two sources disagree (a value, a threshold, a definition), keep both in `conflicts[]`.
8. **BTS mapping**: `verified: false` always (eduscol unreachable from this PC) unless you actually opened an official référentiel page that states it. Épreuves: E1 culture audiovisuelle et artistique, E2 anglais, E3 sciences et techniques (PTES), E4 technique et mise en œuvre (TES/E4 pratique), E51 projet, E52 mémoire/dossier, E6 situation en milieu professionnel. Blocs BC01–BC04. Use the mapping as your best judgment with a `note`.
9. **Ids**: kebab-case English slugs (`gain-staging`, `ringing-out-monitors`). Check `tek-brain/domains.json`: your domain's `seed_concepts` MUST exist in your concepts file (other domains reference them). You may reference other domains' seed concepts freely; reference other concepts only if you are sure they will exist, otherwise create the concept yourself.
10. **Equipment ids** must be real ids from `knowledge-base/equipment/*.json` or `tekpractice-sim/content/catalog.json`. Use Grep on `"id":` to find them. Signals/connectors: ids in `knowledge-base/taxonomy.json` (`tekpractice_*_existing` + `proposed_*`).
11. **Room ids** for scenarios: pick from `domains.json` `planned_rooms` (or `null`).
12. `review`: `"needs-oscar-review"` for anything pedagogically sensitive (exam-like statements, regulation, safety); else `"ok"`.

## Search budget (important)

The session-wide WebSearch quota is small and shared by ~20 agents. **Use at most 6 WebSearch calls in total.** Navigate with WebFetch instead: open the authority's site directly (tech.ebu.ch, itu.int/rec, aes.org (often 403), legifrance.gouv.fr, anfr.fr, arcep.fr, inrs.fr, shure.com/…/insights, dpamicrophones.com/mic-university, sennheiser.com, d&b dbaudio.com, l-acoustics.com, meyersound.com, audinate.com, rane notes on ranecommercial.com, sound-on-sound (soundonsound.com), Wikipedia as secondary). If WebSearch errors (budget), keep going with WebFetch. PDFs: WebFetch them; if binary, use Python `-I` with a stdlib extractor in your scratch folder only.

## Targets for one domain (accuracy beats volume)

~18–25 concepts (all seed concepts included), 2–4 skills, 5–6 procedures, 3–5 rules, 5–6 faults, 2–3 scenarios, 35–45 glossary terms. If you can only verify fewer, deliver fewer and log the rest.

## Rules to mirror / propose (by domain)

- R1 connector-mate, R2 signal, line-into-mic-input, unbalanced-long-run, ground-loop → `electricity-levels`
- R3 direction → `consoles-signal-flow`
- R4 phantom, phantom-on-ribbon, polarity-inversion → `microphones-miking`
- R5 tally, R7 N-1, mix-minus-loop → `broadcast-radio`
- R6 monitor-mute-open-mic, feedback-risk → `monitoring`
- R8 word clock, sample-rate-mismatch → `digital-audio-clocking`
- impedance-load-too-low, amplifier-overload, sub-polarity/delay misalignment → `loudspeakers-system-tuning`
- spl-exposure-limit, missing-earthing → `safety`
- others: propose what your domain's real failure modes need (`status: "proposed"`).

Existing R1–R8 texts are in `tekpractice-sim/content/catalog.json` → `rules`. Mirrors get `status: "existing"`, `catalog_rule: "R4"` and a condition that matches the catalog's check text.

Catalog port vocabulary for conditions: `port.dir` (in|out|bidir), `port.connector` (connector ids), `port.signal` (signal ids), `port.flags` (e.g. isMicInput, providesPhantom, requiresPhantom, isMonitorOut, isDantePrimary, isOnAirTally, isRibbon…; read the catalog to see which flags exist, and list any new flag you need in `needs_catalog_fields` as `"port.flags:isRibbon"`), `device.controls.<id>` (e.g. phantom), `device.category`.

## Examples (one valid record per entity)

concept:
```json
{
  "id": "inverse-square-law", "name_fr": "Loi de l'inverse du carré", "name_en": "Inverse square law",
  "domain": "acoustics-psychoacoustics",
  "definition": "En champ libre, l'intensité d'une source ponctuelle décroît comme le carré de la distance : le niveau baisse d'environ 6 dB à chaque doublement de distance.",
  "explanation": "Texte pédagogique de 3 à 8 phrases, dans tes mots, avec un exemple de terrain (placement d'un micro, d'une enceinte).",
  "formulas": [ { "expr": "L2 = L1 − 20·log10(r2/r1)", "vars": { "r": "distance (m)", "L": "niveau (dB SPL)" }, "source_url": "https://example-authority.org/page" } ],
  "units": ["dB", "m"],
  "related_concepts": ["sound-pressure", "critical-distance"],
  "equipment_ids": [],
  "bts_mapping": [ { "epreuve": "E3", "bloc": null, "note": "Acoustique physique (PTES) — jugement, non vérifié sur eduscol", "verified": false } ],
  "difficulty": 2,
  "sources": [ { "url": "https://example-authority.org/page", "publisher": "Authority name", "accessed": "2026-10-22", "confidence": "verified-secondary", "kind": "university", "covers": ["definition", "formulas[0]"] } ],
  "conflicts": [], "review": "ok"
}
```

skill:
```json
{ "id": "gain-stage-live-input", "name_fr": "Régler le gain d'une entrée en live", "name_en": "Gain-stage a live input",
  "domain": "electricity-levels", "description": "…", "level": "bts",
  "concept_ids": ["gain-staging", "headroom", "dbfs"], "procedure_ids": ["gain-staging-live-input"],
  "success_criteria": ["Les crêtes du chanteur restent sous −6 dBFS au pré-fader pendant le refrain", "…"],
  "bts_mapping": [], "sources": [ … ], "review": "ok" }
```

procedure:
```json
{ "id": "line-check", "name_fr": "Line check", "name_en": "Line check", "domain": "live-sound",
  "context": "Avant l'arrivée des musiciens, vérifier chaque ligne de la scène à la console.",
  "duration_min": 30, "equipment_ids": ["shure-sm58"], "concept_ids": ["signal-flow"], "rule_ids": [],
  "steps": [ { "n": 1, "preconditions": ["Patch scène terminé selon l'input list"], "action": "…", "expected_result": "…", "typical_mistakes": ["…"] },
             { "n": 2, "preconditions": [], "action": "…", "expected_result": "…", "typical_mistakes": [] } ],
  "safety_notes": ["Couper le +48 V avant de (dé)brancher un micro"], "sources": [ … ], "conflicts": [], "review": "ok" }
```

rule:
```json
{ "id": "line-level-into-mic-input", "name_fr": "Niveau ligne dans une entrée micro", "name_en": "Line level into mic input",
  "domain": "electricity-levels", "catalog_rule": null, "status": "proposed", "severity": "warning", "scope": "connection",
  "condition": { "all": [ { "path": "dst.port.flags", "op": "includes", "value": "isMicInput" },
                          { "path": "src.port.signal", "op": "in", "value": ["line-level-pro", "line-level-consumer"] } ] },
  "explanation": "…", "fix": "Utiliser une entrée ligne, un pad −20 dB ou une DI.",
  "evaluable_now": true, "needs_catalog_fields": [], "concept_ids": ["gain-staging"], "sources": [ … ], "review": "ok" }
```

fault:
```json
{ "id": "hum-50hz", "name_fr": "Ronflement à 50 Hz", "name_en": "50 Hz hum", "domain": "electricity-levels",
  "symptom": "Un bourdonnement grave et constant, même sans signal.", "contexts": ["live", "studio"],
  "probable_causes": [ { "cause": "Boucle de masse entre deux appareils sur des prises différentes", "likelihood": "high" } ],
  "checks": ["Débrancher les liaisons une par une pour isoler l'appareil fautif", "…"],
  "fixes": ["Liaison symétrique, DI avec ground-lift, alimenter depuis la même distribution"],
  "rule_ids": ["ground-loop-risk"], "concept_ids": ["ground-loop", "balanced-line"], "equipment_ids": [], "sources": [ … ], "review": "ok" }
```

scenario:
```json
{ "id": "radio-morning-show-phone-guest", "name_fr": "Matinale radio avec invité au téléphone", "name_en": "Radio morning show with a phone guest",
  "domain": "broadcast-radio", "brief": "…", "room_id": "radio-studio-self-op-small",
  "required_gear": [ { "equipment_id": "axia-iq", "qty": 1, "role": "console" } ],
  "signal_flow": { "nodes": [ { "id": "mic1", "equipment_id": "ev-re20", "label": "Micro animateur" }, { "id": "desk", "equipment_id": "axia-iq", "label": "Console" } ],
                   "edges": [ { "from": "mic1", "to": "desk", "signal": "mic-level", "connector": "xlr3-m" } ] },
  "procedure_ids": ["mix-minus-setup-remote-guest"], "rule_ids": ["R7"], "difficulty": 3, "estimated_time_min": 45,
  "bts_mapping": [ { "epreuve": "E4", "bloc": null, "note": "…", "verified": false } ], "sources": [ … ], "review": "needs-oscar-review" }
```
Note: `rule_ids` reference TEK Brain rule ids (the mirror of R7 has its own id, e.g. `mix-minus-n1-echo`). Use the mirror's id, not "R7".

glossary:
```json
{ "id": "crosstalk", "term_fr": "Diaphonie", "term_en": "Crosstalk", "domain": "electricity-levels",
  "definition": "Fuite indésirable d'un signal d'un canal vers un autre.", "see_also": ["balanced-line"],
  "sources": [ { "url": "…", "publisher": "…", "accessed": "2026-10-22", "confidence": "verified-secondary", "kind": "standard", "covers": ["definition"] } ] }
```

File envelope: `{ "entity": "<concept|skill|procedure|rule|fault|scenario|glossary>", "domain": "<your domain>", "generated": "2026-10-22", "items": [ … ], "not_found_log": [ { "what": "…", "searched": "…" } ] }`. Write UTF-8 (no BOM is best; the validator tolerates BOM).

## Validate before you finish

From `C:\Users\brro\dev\Tekonest-wt\tekbrain` run:
```
python knowledge-base/tools/validate_tekbrain.py --domain <your-domain>
```
It must show **0 errors**. Warnings about unresolved references to other domains' concepts or planned rooms are fine; unresolved references to YOUR OWN domain are not (fix them).

## Hand-back (keep it short)

Reply with: counts per entity, number of sources, top 3 findings worth teaching, conflicts found, what you could not verify (not_found_log size), and any rule needing new catalog fields. Do not paste the JSON back.
