# Accounts (mission 1, part B)

Optional sign-up and log-in for TekPractice, behind the `accounts` switch in `src/features.ts` (ships OFF). Trying the app never needs an account; local autosave is unchanged. Nothing in this module runs, loads or sends anything unless the integrator mounts it, which it does only when `FEATURES.accounts` is on.

## Where things are

| Path | Role |
|---|---|
| `src/accounts/ageRange.ts` | The eight age ranges (`-15`, `15-17`, `18-21`, `22-25`, `26-30`, `31-35`, `36-40`, `41+`), French labels, `isUnder15`. |
| `src/accounts/fieldsFor.ts` | Which fields to collect for which age and goal; the under-15 rule; `isStudentGoal`. |
| `src/accounts/profileModel.ts` | The closed `Profile` type (`PROFILE_KEYS`), validation and normalisation, French error messages. |
| `src/accounts/accountService.ts` | The `AccountService` contract: typed results, never throws for expected errors. |
| `src/accounts/supabaseService.ts` | The real service. The ONLY file importing `@supabase/supabase-js` (pinned 2.118.0). Loaded with a dynamic `import()`. |
| `src/accounts/fakeService.ts` | In-memory service for tests. No production file imports it. |
| `src/accounts/consentCopy.ts` | Privacy notice, consent text and parent-confirmation text: DRAFTS, every section marked « à valider ». |
| `src/accounts/accountUi.ts` (+ `.css`) | `mountAccountUi(deps)`: the dialogs, built on `src/creation/shell/modal.ts`. |
| `supabase/` | `schema.sql`, the `delete-account` edge function and a French README for the founder. Provided, not run. |

## Data collected (and nothing else)

E-mail and password (held by the sign-in provider, the password only hashed), then the profile:

- age range (one of the eight; never a birthdate);
- goal: ONE node id of the goal tree (a dotted string such as `etudie.bts-mav-son`), or empty;
- first name, city or region (free text, 80 characters at most), both optional;
- school, only when the goal id starts with `etudie`: a school id from `content/onboarding/schools.json`, or `autre:` followed by free text (80 characters at most);
- the parent or guardian confirmation (under 15 only);
- the date of consent.

No birthdate, phone, employer or address, anywhere. A test pins the profile keys, the form fields, the SQL columns and the privacy text to the same list.

Under 15: only the age range and the goal are asked. The parent confirmation unlocks the other fields and account creation; without it, account creation is refused (before any account exists) and the learner keeps playing locally. The database enforces the same minimum (`profiles_under_15_minimum`).

## Flow

consent (unticked box, privacy text visible) -> sign-up (age range, parent box under 15, e-mail and password, or Google) -> profile form (only the fields `fieldsFor` allows) -> « Mon compte » (sign out, delete). A returning learner gets log-in. « Supprimer mon compte » asks for confirmation, calls the `delete-account` edge function (which trusts only the caller's JWT), signs out, and keeps the local record on the device.

Coming back from the Google redirect or a confirmation e-mail with no profile yet, the profile step resumes by itself (consent again, then the profile form).

## The switch and the integration

`FEATURES.accounts` is false in the product table, and `tools/deploy-guard` / the deploy flag guard refuse an output with it on. When the integrator turns it on, it loads the module lazily:

```ts
const { mountAccountUi } = await import('./accounts/accountUi')
const ui = await mountAccountUi({
  schools,                       // required: parsed content/onboarding/schools.json ({ id, name, cities }[]), may be []
  getGoal: () => storedGoalId,   // the learner's goal-tree node id, or null
  describeGoal: (id) => label,   // optional French label for a goal id
  parent: document.body,         // optional
  onAccountChange: (user) => {}, // optional: sign-in / sign-out
})
button.addEventListener('click', () => void ui.open())
```

`service` is for tests only (the in-memory fake). Without it the Supabase adapter is imported dynamically (its own chunk) and configured from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time. With either missing, every call answers `{ ok:false, reason:'not-configured' }` and the dialogs say so in French.

### In Mode Création (mission 1, part D)

`src/creation/onboarding/accountWiring.ts` (`wireAccounts`) is the integration; `boot.ts` imports it only under `FEATURES.accounts` on a practice address. It adds « Mon compte » and, while signed out, « Se connecter » at the end of the Projet menu; the dialogs and `schools.json` are fetched on the first use of either (or at boot when the address carries a sign-in redirect, `code=` / `access_token=`). The quiet card « Enregistrez votre travail » (copy section `accountPrompt`) shows once, after the plain tutorial ends or the first sound, whichever comes first, only where the plain tutorial is the address's tutorial (where the guide runs, its own tutorial owns that moment), never on an exam address; it takes the tutorial's reserved row only while it is free, opens sign-up (or log-in), and any of its buttons stores `accountPrompt: 'dismissed'` in the onboarding record. With the switch off nothing of it runs: the product e2e (`tests/e2e/onboarding-plain-tutorial.spec.ts`) asserts no request to a Supabase host, no accounts chunk fetched, no account words and no account storage key. The FEATURES table is an object, so Rollup does not fold the switch: the lazy chunks are still emitted in a product build, never fetched.

## No secrets in the repository

No key, URL or project reference is committed; `tests/accounts/noSecrets.test.ts` scans `src`, `supabase`, `tools`, `docs` and `.env*` for JWT-looking strings and provider hosts. Row-level security (`supabase/schema.sql`) protects the data; the anon key is public by design. NOTE: `tools/deploy-guard.mjs` refuses any `VITE_*KEY` variable at deploy time, `VITE_SUPABASE_ANON_KEY` included. Allowing that one name is a founder decision (see `supabase/README.md`).

## Size

The dialogs and their CSS are one lazy chunk (about 27 kB, `LAZY_CAPS` in `tools/chunk-budget.mjs` caps it at 60 kB). The Supabase adapter is a second lazy chunk (about 231 kB, 60 kB gzip, capped at 300 kB). Neither is in the start sums; `tools/chunk-budget.mjs` fails if either becomes statically reachable from the creation start.

## What is not verified

A real Supabase round trip: no project exists yet. The adapter is tested against a stub client, the dialogs against the in-memory fake, the function handler as pure code. The founder's live checklist is in `supabase/README.md`.
