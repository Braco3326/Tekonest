# TEKNEST — Final Report & Prompt Pack
_Complete status of the project + every remaining paste-ready prompt, organized by the student beats and the site logic. Updated 2026-07-18._

---

## 1. The vision & the two products
**Tech Nest** — the AI-integrated platform to help students pass the **BTS Métiers du son** (France). Two products:
- **TekPractice** — the reactive 3D "smart sound simulation" (the game). `D:\teknest\tekpractice` · GitHub `Braco3326/Technest-Sim` · target `www.teknest.fr`. **← the active focus.**
- **Tekskol** — the theoretical course/certificate site. `D:\teknest\tekskol` · GitHub `Braco3326/Technest`. **PAUSED** until TekPractice is validated.

Everything lives under **`D:\teknest\`** (one home, one window per repo, never `Documents`, Defender-excluded). Agents: **designer** + **developer** (`.claude/agents/`).

---

## 2. Where we are (headline)
TekPractice is a **real, playable product on localhost** — Focus & Patch interaction, readiness dashboard, exam mode, sandbox, coach system, onboarding, 2D motion, and ports rigged to real I/O positions, all tested (164 vitest + 32 e2e). What remains is mostly **your content + decisions**, a **"real set" polish system**, the **AI layer**, and **shipping it live**. The site (Tekskol) is built and paused.

---

## 3. What's DONE ✅
**TekPractice engine & content**
- Real-gear catalog v1 (26 connectors, 16 signals, 24 devices, 8 rules R1–R8), all domain logic implemented (phantom/gpio/mixMinus/clock; R8 sample-rate done, ADR-0007).
- Engine core: ConnectionGraph (R1/R2/R3 invariants), RuleEvaluator, LevelRunner, device-state (ADR-0001). Camera never mutates graph (static test).
- 4 levels A1–D1 playable & winnable.

**TekPractice experience**
- **White design system** (tokens, white gallery scene, HUD).
- **Readiness brain + dashboard** — radar BC01–04 + épreuves, one recommended action, streak-with-forgiveness.
- **Exam mode** — timer, no hints, /20, readiness report.
- **Sandbox v1** — shelves, grab/drop, guided gating, feeds readiness, save/load rigs.
- **Environments as data** — studio/radio/plateau + théâtre/plein-air/reportage presets.
- **Coach system** — contextual "Conseils d'Oscar" delivery + tone engine (⚠️ tips are placeholders).
- **Onboarding** — exam date + self-assessment → seeds the path, no signup wall.
- **2D motion** — VU meters, signal pulses, cable feedback, reduced-motion fallback.
- **Focus & Patch interaction** — double-click focus, held-cable, glow, mode-gated hints; replaced drag. (32 e2e + 164 vitest.)
- **Asset rig pass** — 22/24 devices with `port_*` empties at real I/O positions, consumed by the game.

**In progress (agents running):** Sketchfab CC-BY model downloads + rig; realistic environment rooms (theatre/concert/studio/radio).

**Tekskol (site, paused but built):** Next.js, real E3/PTES course, 18-paper annales library, certificate portal, mock auth behind swappable interfaces, SEO pass, AI-tutor UI on landing (wired to Gemini, not yet live).

---

## 4. The student beats — status
| Beat | Student moment | Status |
|---|---|---|
| **1 — First 5 min** | Calm white page → a real win, no signup wall | ✅ (onboarding + white + guided taste) |
| **2 — Daily loop** | One next action, lesson, level, mistakes teach, streak, Oscar tip | ✅ (coach content = placeholder) |
| **3 — Mastery / sandbox** | Freedom unlocks; build & save a rig in any room | ✅ v1 · 🔄 real assets + rooms landing |
| **4 — The dip** | Streak forgiven, mentor arrives at the low point | ✅ system · ⚠️ needs your real tips |
| **5 — Final stretch** | Exam-mode tests → readiness report → last-mile plan | ✅ |
| **6 — Exam day & after** | Transfer; becomes a mentor voice | ◻️ design goal; community later |

---

## 5. What's LEFT (by system)
- **Ship it:** `www.teknest.fr` serves a stale bundle — Vercel Git reconnect + redeploy.
- **The "real set" system** (spec'd, not built): real sizes from datasheets, grounded staging, clear I/O, and the in-app **Set Editor** — see `TekPractice_Set-System.md`.
- **Realistic environments** (agent finishing): rooms in + gear roughly staged; precise placement pairs with the Set System.
- **AI Coach** (real-time, RAG-grounded, socratic) — not started; needs an API key.
- **Your content:** the 13 coach tips (`content/coach/tips.json`), and the pedagogy review (`docs/REVIEW-ME.md` — readiness mapping, exam barème, thresholds).
- **Polish:** perf budgets, low-end 2D fallback, deep-scan, P2 content depth.
- **Tekskol (later):** activate the AI tutor (Gemini key), your E3 content review, then resume.

---

## 6. Manual actions — only you 🔴
1. **Vercel Git reconnect → Redeploy** (TekPractice, then Tekskol). Makes everything live.
2. **Write the 13 coach tips** in `content/coach/tips.json` (your authentic voice — the one thing no AI should fake).
3. **Review `docs/REVIEW-ME.md`** — validate the pedagogy (rules→compétences map, exam scoring, sandbox threshold).
4. **API keys** (in `.env`, never in chat): Sketchfab ✅ done; add `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` when you want the AI coach + site tutor live; optional Tripo/Meshy for AI models.
5. **Product photos** (URLs in each `notes.md`) if you want the AI-generated models.
6. *(Optional)* the apex `teknest.fr` A record → `216.198.79.1` at Wix (www already works).

---

## 7. THE PROMPT PACK (paste-ready, ordered)
All run in the **TekPractice window** (`D:\teknest\tekpractice`), one at a time, unless noted. Standard rules apply: respect CLAUDE.md, commit+push per task, tests green, cite the beat, log to NIGHT_LOG, stop only at gates.

### A — Ship what's built (do first; mostly a browser click)
Reconnect Vercel Git (Settings → Git → `Braco3326/Technest-Sim`/main) → Redeploy. No prompt needed; if the CLI is preferred: `npx vercel --prod` from the repo.

### B — The "Real Set" system (sizes · staging · I/O · editor) — serves Beats 1/3
```
Respecte CLAUDE.md + docs\TekPractice_Set-System.md (spec approuvée). Contenu = data, engine intouché. Délègue le visuel au designer. Fais dans l'ordre, gate à chaque étape :
1. DIMENSIONS : ajoute dimensions {w,h,d} mm à chaque device du catalog (depuis assets-source/**/notes.md) ; DeviceSpawner met chaque .glb à l'échelle réelle. Test check:dims + un test d'échelle. (Kills les tailles random.)
2. STAGING : content/levels/*.json → layout {instanceId:{position,rotation,mount}} ; content/mounts.json (mic-stand, speaker-tripod, foh-desk, rack, floor) stylés tokens ; défauts par rôle ; zones de sol subtiles (blanches). Rien ne flotte, tout au sol/pied. Studio blanc gardé.
3. I/O CLARTÉ : entrées vs sorties visuellement distinctes (couleur + sens + label survol) ; placement lisible source→stagebox→console→enceintes ; routage câbles propre.
4. SET EDITOR (dev, ?edit=1, caché aux étudiants) : sélection device → gizmos move/rotate/scale + panneau mount + drag des ports → Save écrit dans le level/catalog JSON (endpoint dev-server ou download-JSON). Round-trip testé.
Gate final : A1 lit comme un vrai set blanc, échelle correcte, rien qui flotte, I/O clairs ; en ?edit=1 je déplace/scale un device, drag un port, Save, reload → persistant.
```

### C — AI Coach (real-time, RAG, socratic) — serves Beats 2/4 · needs API key later
```
Respecte CLAUDE.md + méthode du skill ai-integrate. Construis le COACH IA temps-réel (distinct des Conseils d'Oscar authorés).
- Interface AiCoach swappable ; provider (Gemini/Anthropic) clé .env DÉFÉRÉE (si absente → "coach IA non configuré", jamais de crash). ADR local vs cloud.
- RAG STRICT : ancré sur catalog + règles R1–R8 + état du graphe + readiness ; n'invente jamais un fait/matériel ; cite la source.
- SOCRATIQUE "teach, don't cheat" : explique POURQUOI, guide, ne donne jamais le fix ; SILENCIEUX en examen.
- Intègre un bouton "Pourquoi ?" sur une erreur.
Tests : refuse une réponse d'examen ; ne cite jamais un device/règle absent ; dégrade sans clé ; muet en examen. docs/prompts/ pour toute finition.
```

### D — Coach content integration (after you write your tips)
```
J'ai rempli content/coach/tips.json avec mes vrais conseils (plus de placeholders). Vérifie le schéma (zod/validator), retire les [À REMPLACER] restants, teste que chaque tip se déclenche au bon trigger (rule/low-moment/comeback/forgiveness/first-win), et mets à jour docs/REVIEW-ME.md. Commit.
```

### E — Polish / perf / low-end fallback + deep-scan
```
Respecte CLAUDE.md. Passe durcissement "smooth/clean/fast" :
1. deep-scan du projet : gaps/edge-cases → corrige le sûr, log le reste dans REVIEW-ME.
2. Perf : budgets glTF/instancing/LOD, cap devices/câbles, dégradation gracieuse ; FALLBACK 2D basse-fidélité pour PC faibles (détecté + testé).
3. Accessibilité WCAG AA (contrastes, clavier, aria, cibles) — vérifie par screenshots.
Fin : NIGHT_LOG + prompts prêts pour tout reste.
```

### F — Tekskol resume (site logic) — WHEN you unpause it, run in `D:\teknest\tekskol`
```
Respecte CLAUDE.md. Reprise du site Tekskol (théorique).
1. ACTIVE LE TUTEUR IA : la clé (GEMINI_API_KEY/ANTHROPIC) est dans .env sur Vercel. Lance les tests d'intégration du tuteur (refus de réponse d'examen, aveu d'ignorance, citations valides) + la vérif E2E en prod. Durcis le prompt si besoin jusqu'à ce que les 3 garanties passent.
2. RELECTURE CONTENU : traite mes corrections de docs/REVIEW-ME.md sur le cours E3/PTES (physique/acoustique/audionumérique) ; applique, redéploie.
3. INTÈGRE LE SIMULATEUR dans le cours E4 (iframe https://teknest.fr ou sim.teknest.fr — le seam est documenté).
4. Connecte GitHub↔Vercel pour l'auto-deploy. Gate : site à jour en prod, tuteur live, simulateur intégré.
```

### G — Session close (every session)
```
Respecte CLAUDE.md. Fin de session : vérifie le build jouable en prod (règle no-drift), résume (fait/décisions/dettes) dans docs/NIGHT_LOG.md, session-vault vers Obsidian, régénère le graphe Graphify.
```

**Recommended order:** A (ship) → finish the running asset/room sourcing → **B (real set)** → E (polish) → C (AI coach, when you add a key) → D (your tips) → then F (Tekskol) when you unpause.

---

## 8. File & doc map (in `D:\teknest\docs\` and this Cowork folder)
- `VISION_TekPractice-Game.md`, `VISION_TekPractice-StudentJourney.md` — the vision + the beats.
- `TEKNEST-MASTER-BUILD.md` — the phased build plan + reorg.
- `TekPractice_Interaction-and-Assets.md` — Focus & Patch spec + asset pipeline.
- `TekPractice_3D-Model-Sourcing.md` — model sourcing (download/AI/model) + license guide.
- `TekPractice_Set-System.md` — the real-set system (sizes/staging/editor).
- `docs/REVIEW-ME.md` — everything awaiting your expert validation.
- `docs/NIGHT_LOG.md` — the running build journal.
- `docs/adr/` — the architecture decisions (ADR-0001 … 0008).
- `assets-source/` (gitignored) — datasheets, notes, model/room candidates, CREDITS.md, SOURCING-QUEUE.md.

## 9. Rules that keep it safe
One home `D:\teknest` · one window per repo · never Documents · content = data (engine untouched) · catalog = source of truth · CC0/CC-BY only + genericize brands for commercial · secrets in `.env` only, never chat · git+GitHub backups current · Fable for the hard reasoning, Opus for the rest.
