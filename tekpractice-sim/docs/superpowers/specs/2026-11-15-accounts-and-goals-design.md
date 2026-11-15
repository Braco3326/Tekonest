# Mission 1: goals, rooms by goal, a plain tutorial, and accounts (behind a switch)

Status: design from the founder's brief of 2026-11-15 (relayed by the Tekonest Master, « card B » and the Auto brief). Branch `deploy/mode-creation-only-20261115`.
Owner: TekoPractice Build-Up. Not touched: `src/guide/**` (Tek Brain, on hold), the engine, catalogue and 3D models.

## 1. What the learner sees

1. **First visit, plain address** (no `?design`): the game opens on design 2 « Atelier » (today only `?design=2` does that). `?design=1..5` still picks a design; an exam address and `?oscar=` keep their meaning.
2. **Goal screens** (replace the four-profile screen as the first question; the profile ids stay in the record for the panels/tab presets, mapped from the goal):
   - Screen 1: five goals (big buttons, keys 1 to 5).
   - Screen 2: the sub-choices of that goal.
   - Screen 3: the speciality inside the sub-choice.
   - Every screen has « Retour » and « Passer » (skip = no goal; all rooms stay visible, nothing is nagged again).
   - The tree is data: `content/onboarding/goal-tree.json` (§3). Until marketing's research file arrives, a **placeholder tree** ships (marked `"status": "placeholder"`), same schema.
3. **Rooms that match the goal.** The place picker shows only the rooms the chosen speciality lists. A goal with no room shows an **empty state** (« Aucun lieu pour ce but pour l’instant ») with two buttons: « Voir tous les lieux » and « Changer de but ». A chip « But : X · changer » replaces « Profil : X · changer » and reopens the goal screens. « Tous les lieux » stays reachable from the picker, always.
4. **A plain tutorial, no Oscar** (§4): « Premiers pas », 4 short steps on a coach card, started from the end of the goal screens (« Faire le tutoriel » / « Passer ») and from Aide.
5. **Save and sign up after trying** (§5): while the accounts switch is OFF nothing about accounts shows. When it is ON: after the tutorial (or the first sound) a quiet card « Enregistrez votre travail » opens sign-up / log-in. Trying never needs an account; local autosave stays as it is.

## 2. Switches (src/features.ts, product table)

`goals: true` (the goal screens, the room filter, the chip) and `defaultDesign: 2` and `plainTutorial: true` ship ON. `accounts: false` ships OFF. The all-on test table sets `accounts: true`, `goals: true`, `defaultDesign` absent (so today's tests keep their plain address) except the specs of this mission which set the address explicitly. `tools/deploy-flag-guard.mjs` refuses a deploy output whose table has `accounts` true (until the founder approves the privacy text and supplies the keys) and one whose table is not the product table. No `.env` is committed; the Supabase URL and anon key are read from `import.meta.env` at build time; with the switch off the adapter chunk is never fetched.

## 3. Goal tree data

```jsonc
{ "version": 1, "status": "placeholder" | "researched", "source": "…",
  "goals": [ { "id", "label_fr", "hint_fr", "profile": "decouvre|etudie|projet|metier",
      "subgoals": [ { "id", "label_fr", "specialities": [ { "id", "label_fr", "rooms": ["room-id", …] } ] } ] } ] }
```
- Exactly five goals. Every `rooms` entry exists in `content/rooms/index.json`; ids unique; every label non-empty French « vous ».
- `rooms: []` is legal (empty state). A pure validator `validateGoalTree` + a loader (`src/creation/onboarding/goalTree.ts`) with tests; the tree is imported as JSON (bundled), so a bad file fails the unit tests, not the learner.
- The stored record gets an optional `goal: { goal, sub, speciality } | null` (new field, old records read unchanged). `profile` is derived from the goal (its `profile` field) so the existing panel/tab presets keep working.

## 4. The plain tutorial (no Oscar, not src/guide)

`src/creation/onboarding/plainTutorial.ts` (pure step machine + DOM card). Four steps on the page's own state, each completes on an observable fact (store/selection), never on a click on the card: 1 place a console, 2 place a speaker (« Enceinte »), 3 connect them (a cable), 4 hear a sound (Écoute). A step shows what to do, one hint after 30 s, « Passer le tutoriel » and « Étape suivante » always present. The card has no avatar, no name, never speaks in the first person (the wording test already forbids it), and is silent in exams (no tutorial in an exam address). Record: `plainTutorial: { step, done }` in the onboarding record. Does not use `guide` (stays false).

## 5. Accounts (behind `accounts`)

- **Provider:** Supabase, EU region, email + password (and magic link) and Google. The founder creates the project and supplies the URL and anon key. Nothing in the repo carries them.
- **Fields collected (only these):** first name, age range, goal and speciality, city or region, school (students only; never an employer). Age ranges: `−15`, `15-17`, `18-21`, `22-25`, `26-30`, `31-35`, `36-40`, `41+`.
- **Under 15 (`−15`):** only the age range and the goal are collected; first name, city and school are hidden. A parent or guardian confirmation (a checkbox declaring it, wording « à valider ») unlocks account creation and the other fields. Without it the learner keeps playing locally and may not create an account.
- **RGPD (drafts marked « à valider »):** a French privacy notice and a consent text (purposes, legal basis, retention, rights, EU hosting, contact placeholder), shown before the form and linked after. Consent is an unticked box; the account is not created without it. **Delete account** really deletes: the client calls an authenticated edge function that removes the profile row and the auth user; the learner is signed out and the local record kept only on his device.
- **Code shape:** `src/accounts/` (all lazy, one chunk): `ageRange.ts`, `fieldsFor.ts` (which fields for which age), `profileModel.ts` (validation), `accountService.ts` (interface), `fakeService.ts` (tests), `supabaseService.ts` (the adapter, the only file that imports `@supabase/supabase-js`), `accountUi.ts` (the dialogs), `consentCopy.ts` (the drafts). `supabase/schema.sql` (profiles table, RLS: a row is readable and writable only by its owner) and `supabase/functions/delete-account/index.ts` are provided for the founder to apply; they are not run by this work.
- **What cannot be verified here:** a real Supabase round trip (no project yet). The adapter is tested against the interface with a fake; the live round trip is a checklist for the founder (open decision).

## 6. Not in this mission

Marketing's real goal tree (placeholder until it arrives, swap = replace one JSON); sending the learner's goal anywhere (analytics): nothing leaves the device while `accounts` is off; the designs 1, 3, 4, 5 keep their own start screens.

## 7. Tests (red first)

Unit: `goalTree.test.ts` (schema, rooms exist, five goals), `onboardingRecord` (goal field, old record), `roomsForGoal` (filter, empty), `defaultDesign` (`designFromSearch` + feature), `plainTutorial.test.ts` (machine), `accounts/*.test.ts` (age range table, fields per age, under-15 gate, consent required, validation, fake service sign-up/log-in/delete, no key in the bundle and in the repo), `deployFlagGuard` (accounts on is refused). E2E (`tests/e2e/onboarding-goals.spec.ts`, product build): plain address opens design 2, goal screens 1 to 3, filtered picker, empty state, chip, tutorial four steps, no Oscar, no account UI, no console error.

## 8. Deploy

Auto-deploy was asked by the Master; the founder's own yes is asked in chat before the push (peer messages are not approval). Sign-up ships OFF.
