# Round 2: educational game designer (Karim Benali)

## The other three

**Hélène Marchetti (audio engineer)**
- **Strongest point:** she separates *verifying* the code from *validating* the model, and notes that errors on differences are smaller than errors on absolute levels. She also finds the S1 path-difference error (Δd gives 38,5 ms, not 40,8 ms), which makes the brief's own example fail its ±2 ms criterion.
- **Most dangerous assumption:** that labels ("moyenne statistique", "somme énergétique", "spectre supposé") keep novices from forming misconceptions. They don't: a first-year student reads the map and ignores the caption. Honesty has to come from what is *shown*, not from more text. She also assumes one room measured at 5 points gives an error bound for all 32 rooms.

**Lena Vogt (3D interaction designer)**
- **Strongest point:** "displayed vs live" must always be explicit. That is not only a UX point. If students can't tell which state they are looking at, the method we want to teach (change, observe, compare) breaks down.
- **Most dangerous assumption:** Essais off in the exam by default. E4 assesses method, so taking away the trail removes the evidence the examiner needs. Her real concern, that maps give hints, is solved by turning off the overlays and target bands, not the Essais.

**Tomás Ferreira (data architect)**
- **Strongest point:** "No silent deletion; trials are evidence." That is the right stance, and it matches mine.
- **Most dangerous assumption:** that the student's localStorage is the place where evidence lives. With a ~150-trial hard cap that the student sees, a class can get "stockage plein" in the middle of a lesson, which is a teaching failure. He also lets notes stay editable through `setNote`, which weakens them as evidence.

## Tensions

**Fidelity (b) with relative dB only.** I accept it as the cap, which refines my position rather than changing it. Hélène's rules (relative readouts by default, no absolute dB next to the decree limits, S1 scored on timing) remove findings 1, 6 and 8 from my round 1. I still gate (b) on a classroom trial of B + (a): her measurement validates the physics, the classroom trial validates the learning.

**No backend, and localStorage limits.** This makes the export *more* important, not less: it becomes the only route to the teacher.
- The **evidence of record is the exported file** (JSON with the data embedded by value, as Tomás specifies, plus a printable "fiche de calage"), handed in like a lab report.
- localStorage becomes a working copy. When it fills up, the game prompts "exporter puis archiver" instead of blocking.
- The export replaces Lena's empty phone mode: the teacher reads the fiche on any device.
- Teacher view = a static read-only page that opens the file. No server is needed.
- The export carries points, the summary and notes, but no grids, which keeps it small.
- Forgery is possible without signing. That is acceptable for formative use. In the exam, the teacher is in the room.
- Notes lock once a child Essai exists; later edits are appended with a timestamp.

## Position

Held and refined: C, staged. Phase 1 (B) is built around evidence: a prediction field, rule results frozen in each Essai, and a file export. Phase 2 (a) follows. Phase 3 (b) uses relative dB only, after one classroom trial and Hélène's measurement campaign.

POSITION: C staged, B evidence-first → (a) → (b) relative-dB only after classroom trial | CONFIDENCE: 78% | RISK: I'd block S1 crediting delay with level, absolute dB(A) beside decree limits, phase 1 without prediction field + file export, and Essais removed from exam (overlays off instead)
