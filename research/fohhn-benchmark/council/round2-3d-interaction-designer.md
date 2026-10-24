# Round 2: Lena Vogt (3D interaction designer)

## The other three

**Marchetti (audio)**
- **Strongest point:** relative levels by default, and a delay is never credited with a level gain. This also removes the false-precision decimals from the UI.
- **Most dangerous assumption:** that every result can carry "champ direct · somme énergétique · spectre supposé · fidélité". At 1366 px the caption cannot hold those labels next to essai, quantity, band and freshness. If the labels are always shown, students stop reading them. Put the caveats on the fidelity chip's pop-over and keep one short, permanent word in the caption ("relatif").

**Benali (pedagogy)**
- **Strongest point:** the prediction is written before the result, and a teacher can read the trail without the student's browser.
- **Most dangerous assumption:** capped, counted evaluations. That turns G into a scarce resource, so an accidental key press costs an attempt. If a cap is used, Évaluer needs a confirmation step and the toolbar must show the count left ("2/3"). Varying the UI by year (3 Essais, no tree) adds configuration modes. It is acceptable only as a level setting, never as a hidden toggle.

**Ferreira (data)**
- **Strongest point:** nothing is ever silently deleted, and the consumed inputs are embedded by value.
- **Most dangerous assumption:** "the draft is not persisted". ADR-0010 reloads the page on every room or level change, so the live setup would vanish without warning. The live setup must be autosaved, even though it is not a Trial. A "corrupted / fingerprint mismatch" result on load is one more state, and it needs its own visible wording.

## Tensions

**Prediction and export at 1366 px: compatible.**
- The prediction is part of the **Figer/Évaluer flow**: a short inline pop-over anchored to the button, with "Je change… / je m'attends à…" and Enter to confirm. It is not a permanent panel field, so it costs no width.
- The note stays in the Essais panel, which is the one panel open at a time.
- Export is an item in the panel's "⋯" menu.
- The **teacher view** is a separate read-only DOM page: an imported JSON file, the list, the table and a 2D SVG plan, with no Babylon. It is responsive, so it **replaces my blocked phone mode**: the phone gets something real to show.

**S1 arrival times: not a heatmap.**
- **Primary:** a DOM timeline in the Essais or Fiche panel. Each named point gets one row with main and delay ticks on a ms axis, the precedence window (5–15 ms, once sourced) shaded, and the gap written out ("principal d'abord, +9 ms").
- **In 3D:** pins show the order and gap as text.
- **Optional zone map:** two categories, "ordre correct / incorrect", coded by **pattern as well as colour**.
- No animated wavefronts: they hurt the frame rate and reduced motion, and students would read them as physics.

## Position

My position holds, with refinements:
- **Phase 1 (B)** gains prediction-in-flow, autosaved live state, export and the teacher DOM view.
- **Phase 2** is fidelity (a).
- **Fidelity (b)** stays gated: relative only, after a classroom trial and real-laptop performance figures.

[POSITION CHANGE: B now, C (a→b) gated + phone mode blocked → B now with prediction and teacher DOM view (which replaces phone mode), (a) next, (b) relative-only after classroom trial | Trigger: Benali #11, Marchetti #8, Ferreira #1 vs the ADR-0010 page reloads]

POSITION: B now (prediction-in-flow, autosaved live state, teacher DOM view replaces phone), then (a); (b) relative-only after classroom + real-laptop gates | CONFIDENCE: 78% | RISK: I'd block PageUp/PageDown overloading, hidden displayed-vs-live state, unpersisted live drafts lost on reload, uncapped caption label creep, and a level heatmap used for S1 timing
