# Open questions for Oscar

Decisions the overnight run could not, or should not, make alone. Each one gives a recommendation and where to look.

## A. TekPractice

1. **Which devices to add first?** Recommended order (details in `equipment/tekpractice-mapping.md` §3):
   1. Radial JDI + J48 (DI and phantom lessons, existing ids only).
   2. Crown XLS 2502 + d&b Y10P (first passive speaker-level chain on `speakon-nl4`, a catalog id no device uses yet).
   3. Royer R-121 (R4 already warns about ribbons, but there is no ribbon in the catalog).
   4. Telos Hx2 / Sonifex RB-MM1 (phone N-1).

   Are the "school desks" (Behringer X32 + Midas DL16, or Allen & Heath SQ-6 + AR2412) more motivating for students than the Yamaha QL1 ecosystem?
2. **AETA codecs are discontinued.** AETA lists the Scoop5 S and Scoopy+ S under "Anciens produits". Keep them (they are still everywhere in French radio) and add a "legacy" note, or move C1 to the AETA ScoopTeam or another current codec? *Recommendation: keep them and add a note.* Real installed bases outlive catalogues.
3. **Split `aoip` into Dante / AES67 / AVB-Milan / AES50?** The KB uses them as separate proposed signal ids (31 / 16 / 5 / 3 devices). Splitting enables "Dante is not Milan" lessons, but every existing AoIP port would need a decision. *Recommendation: split only when a level needs it.*
4. **New connector ids.** Adopt the top proposals (`dc-barrel`, `xlr4`, `midi-din5`, `bnc-antenna-50ohm`, `mini-xlr-ta4`, `euroblock-phoenix`, `speakon-nl8`, `binding-post`) into `catalog.json`? Agents also proposed `xlr7`, `mini-xlr-ta5`, `mmcx`, `rj11` and others, which are not yet in taxonomy.json.
5. **`ev-re20` 3D asset.** It currently uses an SM7B mesh. `3d-models.md` suggests a generic CC-BY "broadcast microphone" instead. Swap it?

## B. Licences and 3D

6. **Licence floor.** The run used CC0 + CC-BY (with attribution). That matches the "recommended now" option in `tekpractice-sim/docs/TekPractice_3D-Model-Sourcing.md`. Confirm, or restrict to CC0 only?
7. **Branded CC-BY models.** 40 catalogue entries are "with work", mostly needing logo removal. Do you want branded variants kept internally (as ASSET_MANIFEST's `branded-internal` does today), or only genericized assets from now on?
8. **The 20 downloaded glb files** are in `knowledge-base/3d-models/`, not in `tekpractice-sim/public/assets/`. Move the useful props (rack, desk, stool, lights, stage) into the sim's environment pipeline? They still need the rig and optimization pass.
9. **L-Acoustics CAD files (K2, X15 HiQ, KS28)** state no reuse terms on their pages, so they are link-only. Ask L-Acoustics (a French manufacturer) for permission for an educational use?

## C. Learning platform (content found to need a check; nothing was edited)

10. **Possible error in `learning-platform/src/data/courses/e3/unit1-acoustique.ts`.** The course says "EBU R68 : +4 dBu ↔ −18 dBFS". The sources found (EBU Tech 3276, ITU-R BS.645) give the analogue alignment as 0 dBu ↔ −18 dBFS. EBU R 68 itself defines the digital alignment level. Please check and correct (`fundamentals/02-decibels-gain-staging.md` has the sources).
11. **Null angles in `unit3-transducteurs.ts`** (126° supercardioid / 110° hypercardioid) differ from DPA's rounded figures. These are probably the theoretical first-order values versus the manufacturer's rounding. Decide which to teach and cite.
12. **BTS savoir codes are unverified.** The eduscol STI site, including the référentiel PDF, refused every connection from this PC overnight. All `bts_mapping` entries in `fundamentals/*.md` are `verified: false`. Could you open the référentiel PDF (link in `learning-platform/src/data/referentiel.ts`) and confirm the S-codes, or send the PDF so a later run can map them?
13. **French regulation.** The décret 2017-1244 figures (102 dB(A) / 118 dB(C) over 15 min; 94/104 for under-6s) are sourced through ARS Île-de-France and a CIDB presentation, not the Légifrance text, which would not render. Confirm on Légifrance before teaching them as exam facts.

## D. Data quality follow-ups

14. **Second pass when the search budget allows.** The session's web-search cap ran out early, so whole manufacturers that render by script or block bots are thin or missing: Yamaha manual library, Neumann downloads, Behringer/Midas, AKG/Harman, Sony, Audio-Technica, Sound Devices, Electro-Voice, avid.com, Belden, HBK. These are listed in `manuals-missing.md` and the per-file `not_found_log`. A run with a higher `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`, or a manual pass in a browser, would close most of them.
15. **`year_introduced`** is "not found" for most devices: manufacturers rarely state it. Is it worth a dedicated pass using trade press (Sound On Sound, Mix, TEC Awards)?
16. **French manuals.** Only about 69 of 357 devices have a French manual recorded (higher for Sennheiser, Shure wireless, NEXO, d&b, AETA, Focal). Should the course link English manuals by default and French where available? *Recommendation: yes.*
