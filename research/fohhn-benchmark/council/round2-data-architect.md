# Council round 2: data architect (Tomás Ferreira)

## On the other three

**Hélène, audio systems engineer**
- *Strongest point:* her #8, combined with relative output by default. Energetic summation ignores time, so a delay cannot change level. A frozen S1 result scored on level would be meaningless forever.
- *Most dangerous assumption:* that one measurement campaign in one room justifies an error bound. All 32 rooms are `needs-oscar-review` estimates, so a bound validated in one room does not carry over. Any shown bound must be tied to the measured room's `geometryRev`, with the measurement data and its provenance stored.

**Karim, educational game designer**
- *Strongest point:* his #9. Freezing `LevelState`, the R1–R8 violations and a prediction turns phase 1 from a diff log into evidence.
- *Most dangerous assumption:* that an exported localStorage trail is proof. With no backend, a JSON file can be edited. A fingerprint detects accidental drift, not forgery. Teachers must be told the export is "déclaratif", and exam integrity needs `ExamScore` persisted plus a mechanism that ADR-0011 decides.

**Lena, 3D interaction designer**
- *Strongest point:* compare is read-only, and "displayed vs live" is always explicit. This is the same invariant as no-mutation, enforced in the UI.
- *Most dangerous assumption:* that pressing G on an unchanged fingerprint is a no-op. If the room, speaker data or engine changed, the inputs fingerprint is unchanged but the refs differ, so G must re-evaluate. The no-op test must be `fp equal AND refs equal`. Her URL-encoded Essai also caps the size (inputs only, no grids) and leaks data into history and logs, so it is file export only.

## Tensions

**Karim's additions to the schema:**
- `ruleResults: {ruleId, code, instances[]}[]` stored by value, plus `levelState` and `rulesRev` (a hash of the catalog rules plus the evaluator version). These are excluded from the input fingerprint.
- `prediction: {text, writtenAt}`, with the invariant `writtenAt < result.computedAt`, checked on load.
- Note locking: `note` becomes immutable once a child exists. Later edits go to an append-only `noteAmendments: {text, at}[]` and never overwrite.
- Budget: about +1 KB per trial (8 rules × about 80 B, plus a prediction of about 300 chars). That brings a trial to about 4 KB, or about 600 KB under my global cap of 150 trials. It fits, but the global byte budget is now mandatory.
- The teacher export moves into phase 1, so my finding 14 (self-contained `formatVersion` envelope) becomes a phase-1 exit test.

**Hélène's additions to the frozen inputs:**
- `ComputeSettings.drive` becomes `{kind:'headroom', dbBelowMaxContinuous ≥ 0} | {kind:'passive', voltsRms, impedanceOhm}`.
- Also in `ComputeSettings`: `assumedSpectrum: 'pink'`, `referencePointId`, and the directivity parameters `{n, rearFloorDb, validBandHz}`.
- Embedded room: `surfaceM2`, `volumeM3`, `estimated`.
- Embedded speaker: `maxSplContinuousDb`, `maxSplKind`, and `impedanceOhm?`. `sensitivityDb1W1m` is allowed only on passive speakers, enforced by a zod refine.
- All of these are fingerprinted, because changing any of them changes the result.
- Results store **relative** values (to the reference point) as primary, and absolute values only as tagged internals.

## Position

I hold position B and refine it: phase 1 now includes the evidence fields, note amendments and the export. My cap on C moves to (a) first, with (b) gated, matching Karim and Lena.

[POSITION CHANGE: C capped at (b) → C capped at (a), (b) gated on a classroom trial + measurement | Trigger: Hélène #8/#12 and Karim #1 show that (b) results would be frozen with meanings that later turn out wrong]

POSITION: B now (evidence-bearing phase-1 Essai: rule results, prediction, note amendments, self-contained export); C (a) next, (b) gated | CONFIDENCE: 82% | RISK: I would block mutable notes, a G no-op that ignores refs, a URL-encoded Essai, a per-room-only storage cap, reset-on-mismatch, and drive in watts for powered speakers
