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

## E. TEK Brain (run 2, 2026-10-22). Answered by the run, please review

Each question below would normally have been asked before building. The run picked the default shown and kept going.

17. **File layout.** One file per entity type per domain (`tek-brain/<entity>/<domain>.json`). *Why: 17 research agents write in parallel without collisions.* (DESIGN §2, D1)
18. **Id uniqueness.** Unique within an entity type only; references are typed by field name. (D2)
19. **Machine-checkable rules.** Conditions are a small JSON DSL over catalog port/signal/device fields. Rules that need data the catalog does not have (impedance, power rating, cable length, SPL) are marked `evaluable_now: false` and list `needs_catalog_fields`; those become catalog proposals, never direct edits. (D3)
20. **BTS mapping.** Every TEK Brain `bts_mapping` stays `verified: false` until someone checks the référentiel (same blocker as #12). (D5)
21. **Room coordinates.** Floor-centre origin, metres, z toward the audience/listener. (D6)
22. **How the game gets rooms.** A sync tool in `tekpractice-sim/tools/` copies validated templates into `content/rooms/`, because Vercel only builds `tekpractice-sim/`. (D8)

## F. TEK Brain content and data (run 2), for Oscar to decide

23. **Proposed rules to implement first in TekPractice.** 15 of the 82 TEK Brain rules can be evaluated with today's catalog (for example line level into a mic input, mic level into a line input, consumer into pro level, instrument into a line input, phantom into an unbalanced link, AES3 into S/PDIF). They are cheap wins: a new `logic/*` check each. *Recommendation: start with the electricity-levels ones (most frequent BTS mistakes).*
24. **Catalog fields the other rules need** (`needs_catalog_fields` per rule): port impedance and power handling, amp minimum load per mode, cable length, RF frequency and band, `isRibbon`, `isUnbalanced`, aux send point, insert send/return flags, and session fields (SPL Leq, loudness). Which to add first? *Recommendation: `isRibbon` and `isUnbalanced` flags (cheap, two lessons each), then impedance/power for a passive-PA level.*
25. **134 catalog proposals** (`tekpractice-sim/content/proposals/catalog-proposals.json`) and **15 level drafts** (`content/levels/drafts/`). Pick the ones to publish. The mapping recommends Radial JDI and J48, Crown XLS 2502 with d&b Y10P, Royer R-121 and Telos Hx2 first.
26. **Equipment gaps** found while writing scenarios: no DJ mixer or player, no conference DSP with echo cancellation, no IR interpretation system, no hearing-loop driver, no small-diaphragm omni (DPA 4006 / Schoeps MK 2) in the equipment KB. Should a third research pass add them?
27. **Room templates** use estimates where venues do not publish a dimension (listed in each template's `not_found_log`). Do you know real venues (your school's studio, a Paris SMAC, a radio studio you work in) whose measurements we could use instead?
28. **Sketchfab licences** (525 run-2 catalogue entries) come from the search API because the per-model API was rate-limited. Before downloading any, re-check the licence on the model page, or give the run a Sketchfab API token (never committed) so the agent can verify and download.
29. **Décret 2017-1244 / Code du travail figures** are taught from ARS, INRS and DGS sources because Légifrance did not render for scripts. The worker peak **limit is 140 dB(C)** (137 dB(C) is the upper action value). Please confirm on Légifrance before exam use.
30. **Monitor reference levels.** EBU (85 − 10·log n dB(A), −18 dBFS) and cinema practice (−20 dBFS, 83/85 dB C) are both recorded. The often-quoted "79 dB for small rooms" was found only in forums, so it is not taught. Which convention should the course teach?
31. **Super/hypercardioid null angles** vary by source: Shure gives 125/126° or about 115°, DPA about 135° (supercardioid); for hypercardioid Shure gives 110° and DPA 115°. This reinforces #11. *Recommendation: teach a 110–135° range and "check the datasheet".*
32. **Spot-check pattern.** Agents sometimes add an unsourced "field practice" sentence to a sourced field. All sampled cases were fixed, but the same pattern may exist in unsampled records. Worth a second QA pass on procedures and faults?