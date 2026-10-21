# PRODUCT-LATER — the seams, and how to grow through them

This document names every seam deliberately left in the codebase so the mock
platform becomes a real product **without touching pages or components**.

## 1. The three swappable interfaces

Pages and components never talk to storage or to the AI backend. They consume
React hooks from `src/lib/providers.tsx`, which are backed by three interfaces:

| Seam | Interface | Impl (today) | Real/alt impl (later) |
|---|---|---|---|
| Auth | `AuthProvider` — `src/lib/auth/types.ts` | `LocalAuthProvider` (localStorage) | e.g. `SupabaseAuthProvider` |
| Progress & certificates | `ProgressStore` — `src/lib/progress/store.ts` | `LocalProgressStore` (localStorage) | e.g. `SupabaseProgressStore` |
| AI tutor | `AiTutor` — `src/lib/ai/types.ts` | `ApiAiTutor` (→ `/api/tutor`, Claude API server-side) | e.g. an edge function, or a batched offline tutor |

**The swap is three lines** in `src/lib/providers.tsx`:

```ts
const authProvider: AuthProvider = new SupabaseAuthProvider();
const progressStore: ProgressStore = new SupabaseProgressStore();
const aiTutor: AiTutor = new EdgeAiTutor();
```

The AI tutor's design decisions (corpus retrieval, socratic prompt contract,
citation validation, model choice) are recorded in
`docs/adr/0001-assistant-ia-tuteur.md`. Its retrieval module
(`src/lib/ai/corpus.ts`) is the seam for scaling to embeddings when all
courses open.

Every method on both interfaces is already `async` (returns Promises), so a
network-backed implementation changes no call sites and no rendering logic.
The pure domain logic (gating, scoring, certificate metadata) lives in
`src/lib/progress/model.ts` and is storage-agnostic — do not duplicate it
server-side; import it.

### Supabase sketch
- Tables: `profiles(id, name, email)`, `course_progress(user_id, course_id, jsonb)`,
  `certificates(user_id, jsonb, verification_code unique)`.
  The `CourseProgress` and `Certificate` types serialize as-is to `jsonb`.
- `LocalAuthProvider.logIn(email)` (passwordless mock) maps naturally to
  Supabase magic links; `signUp(name, email)` adds a password/OAuth step in the
  new impl only — the interface stays.
- Migration path for existing local users: on first login, read the
  `technest.*` localStorage keys and POST them (one-time import function; the
  keys are versioned `.v1` for exactly this purpose).

## 2. Certificate verification (public)
`/verification` currently checks certificates stored on the device and says so
in the UI. Real version: a public API route `GET /api/verify/:code` querying the
`certificates` table by `verification_code` — the page keeps its exact UI, only
the lookup function changes. Verification codes are already unique per
certificate (`TN-XXXX-XXXX`, `makeVerificationCode()` in `model.ts`) — swap
`Math.random` for a server CSPRNG in the real impl.

## 3. Where the Audio Simulator embeds (E4)
The course `e4-tmo` (`src/data/courses/index.ts`) is the seam:
- Its `stubNote` announces the simulator ("bientôt") on `/cours/e4-techniques-mise-en-oeuvre`.
- When the simulator (../audio-sim, deployed separately) is ready, E4 becomes a
  `status: "available"` course whose units carry a new LessonBlock —
  suggested: `{ type: "sim"; levelId: string }` rendered by an
  `<AudioSimEmbed levelId>` iframe/component pointing at the simulator build.
  Add the variant to `LessonBlock` in `src/data/types.ts` and a case in
  `LessonRenderer` — content files stay pure data.
- The simulator's own `ProgressStore` (mistake history) shares this
  architecture, so a common backend can serve both once accounts are real.

## 4. Content pipeline
Course content is typed data in `src/data/courses/**` (one file per unit; the
`Course` object assembles them). To add a course: create the data files, add the
course to `COURSES` — no component changes. The référentiel metadata
(`src/data/referentiel.ts`) and the annales index (`src/data/annales.ts`) are
seeded 1:1 from the research CSVs in the parent folder; update those files when
new sessions publish (new E3 sujet each July).

## 5. Later features and their anchors
| Feature | Anchor in today's code |
|---|---|
| AI tutor (RAG on référentiel + annales) | lesson pages are server components; add a client `<TutorPanel courseId unitId>` next to `LessonFooter` |
| AI feedback on uploaded mixes | new page under `/cours/e4-*/`; consumes the same `ProgressStore` |
| Exam attempt analytics / weak-spot detection | `CourseProgress.examAttempts[]` already stores every attempt with scores |
| Teacher/parent dashboards | `ProgressStore.getAllProgress(userId)` is the read model |
| Paid tier (human review, coaching) | keep courses free (positioning); gate the human-escalation features only |

## 6. Known mock limitations (accepted for now)
- Accounts are per-browser, no password, no server — clearly labeled "bêta" in the UI.
- Certificate verification is device-local (labeled in the UI).
- Survey answers are stored locally and read by no one — the real backend should
  collect them (they're already structured `Record<questionId, answer>`).
- PDF export uses the browser print dialog (deliberate: zero deps, perfect
  typography). A server-rendered PDF can come later without UI changes.
