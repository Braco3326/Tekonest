# Tekonest umbrella site, round 1: two doors

Date: 2026-10-28. Status: **draft for founder review**. Branch `site/two-doors`, cut from `origin/design/tekonest-umbrella-brand` (`6485dc0`). Local only: nothing is pushed or deployed.

## 1. Purpose

Bring the public umbrella site (`website-prototype/`, live at tekonest.com) in line with the founder's 28 Oct definition of Tekonest, without changing its visual identity.

Success looks like this: a visitor sees **two doors**, *Se former* and *Créer avec nous*. The second door is a client-facing creative and technical service, "une expérience au service de votre projet". Nothing on the site mentions a network, and nothing promises what does not exist.

## 2. Decisions already taken (founder, 28 Oct 2026)

| # | Decision |
| --- | --- |
| 1 | The umbrella has two doors: **Se former** (Apprendre platform + TekPractice) and **Créer avec nous**. |
| 2 | Door names stay as they are. |
| 3 | **Créer avec nous** is a service for people with a project (show, film, event, artistic project) who want to discuss it with the Tekonest team. Four families: création sonore (composition sonore et cinématique, sound design); prise de son (tournage, captation); live (DJ set, prestation technique à la demande); direction artistique, mixage et mastering. |
| 4 | The artist and technician **network is set aside**: removed from the public site and the map's visible structure. Its files stay in git history (nothing is deleted). It was built for the Rebels pilot. |
| 5 | Rebels × Tekonest stays a separate project. |
| 6 | Legal questions (structure, pay rules, performer and licence rules) are discussed after the structure is settled. They are out of scope here and no legal claim is added. |
| 7 | Round scope: structure and content on the current identity (Nuit, Papier, Crème, Ambre, Prune; Tektur; Damas motifs). No new visual direction. |

## 3. Out of scope

- New visual direction, WebGL hero (Higgsfield frames), or a public "all angles" (2D/3D/4D/5D) element. Revisit in round 2.
- Legal, pay and structure wording beyond what the site already says.
- Deploying. Pushing `design/tekonest-umbrella-brand` is what publishes tekonest.com, and any pushed branch gets a public Cloudflare preview.
- The private mind map branch (`site/tekonest-map`). Its outline needs a follow-up edit after this round.
- Public-repo exposure of brand and Rebels documents (people's names, founder status). Raised separately.

## 4. Design

### 4.1 Information architecture

- Navigation: **Se former · Créer avec nous · L'histoire · Contact**. Footer adds Accessibilité.
- Home shows two doors. The "Trois entrées" section becomes "Deux entrées".
- `reseau.html` leaves the build (source fragment and built file removed with `git rm`).
- `organiser.html` is replaced by `creer.html`, so the file name matches the label.
- `_redirects` (new): `/organiser`, `/organiser.html` → `/creer.html`; `/reseau`, `/reseau.html` → `/`. This keeps old links alive.

### 4.2 The page *Créer avec nous* (`creer.html`)

Draft French copy (inclusive-writing rules of `design/01-positioning.md` apply, no point médian):

- Status tag: **Offre en projet**. Each family card also carries « En projet » until the founder confirms what is already deliverable.
- h1: « Une expérience au service de votre projet. »
- Lead: « Spectacle, tournage, événement, projet artistique : vous venez avec une idée, nous la construisons avec vous. »
- Four cards:
  1. **Création sonore**: composition sonore et cinématique, sound design pour l'image, la scène ou une installation.
  2. **Prise de son**: pour un tournage, une captation ou un enregistrement.
  3. **Live**: un DJ set ou une prestation technique à la demande, selon les besoins du projet.
  4. **Direction artistique, mixage et mastering**: accompagner la direction artistique d'un projet, mixer et masteriser vos titres.
- « Comment ça se passe » (4 numbered steps): vous nous parlez de votre projet; nous en discutons avec l'équipe; nous vous proposons une façon de travailler ensemble; nous le réalisons.
- Call to action: « Parlez-nous de votre projet » → `contact.html`. Note: « Ce n'est ni un devis ni un engagement, de votre côté comme du nôtre. »
- No price, no availability claim, no pay or legal wording. The current Rebels × Tekonest line is removed (separate project).

### 4.3 Other pages

| Page | Change |
| --- | --- |
| `index.html` | Meta description and hero line: « Se former, créer : des fils tressés ensemble. » Button « Les deux entrées ». Two door cards (Se former, Créer avec nous). « Sept fils, sept métiers » keeps the seven trades but drops "le réseau veut réunir": reworded as the seven trades Tekonest works with. Status board: two rows removed or changed (Réseau removed; Créer avec nous row reflects the four families and "En projet"), date set to the build date, TekPractice next step reworded from the project's status map. |
| `histoire.html` | Rewrite the "deuxième envie" paragraph (network) as the creation service. The sentence about the musician and the DJ who agreed to cofound is left untouched (founder question F-04 stays open). |
| `contact.html` | Remove "pour le réseau" from the helper note; add « un projet à créer avec nous ». |
| `build` shared layout | Nav and footer text updated; footer line « rejoindre un réseau payé correctement » replaced; footer date set to the build date. |
| `apprendre.html`, `tekpractice.html`, `accessibilite.html` | Only links and wording that point at removed pages. |

### 4.4 Brand documents kept in sync (small, separate commit)

- `design/05-site-map.md`: new tree (two doors, `creer.html`).
- `design/12-design-system/README.md`: logo line "sept personnes du réseau" → "sept métiers"; "trois entrées" → "deux entrées".
- `brand/04-decisions-and-questions.md`: add decision D-09 (network set aside, door 2 redefined, 28 Oct 2026). Earlier records are not rewritten.

### 4.5 Build tooling

`src/build.py` needs Python, which is not installed. Replace it with a Node build (`website-prototype/tools/build.mjs`, same layout, same French typography rules: narrow no-break space before `; : ! ?` and inside « »).

Safety: before any page edit, the Node build runs on the **unchanged** sources and its output must be byte-identical to the committed `*.html`. Only then are pages edited. `build.py` is removed in the same branch once equivalence is shown, and the website README is updated.

## 5. Testing and acceptance

1. Equivalence: Node build output equals committed pages before edits (see 4.5).
2. Banned strings absent from all built pages (`_redirects` is not a page): `reseau`, `Réseau`, `Trois entrées`, `trois entrées`, `organiser.html`, `Rebels`. The word `réseau` is grepped too, and every hit is read by hand, because it can legitimately mean an audio network on the learning pages; no hit may refer to the network service.
3. Every internal link and image resolves (link-check script, 0 broken).
4. axe-core WCAG 2.2 AA: 0 violations at 375 and 1440 px on every page.
5. No horizontal overflow at 375, 768, 1440 px.
6. Nav at 375 px: toggle, Esc closes, focus returns (as in the 22 Oct review).
7. Reduced-motion and no-JS views still readable.
8. Screenshots at 1440 and 390 px of each page saved under `design/07-review/screens-2026-10-28/`.
9. Statuses: every offer shows an honest status; no sentence says something is available that is not.

Not covered: screen-reader pass, real five-second test, live deployment checks, Cloudflare cache purge for `/soirees`.

## 6. Risks and open questions

| Item | Note |
| --- | --- |
| Which of the four families the founder can already deliver | Until answered, all are « En projet ». |
| Redirect targets | `/reseau` → `/` is a recommendation; `/reseau` could instead 404. Founder may prefer a short note on the home page. |
| Contact e-mail (F-05) | Still undecided. The Contact page and every call to action stay "à définir". |
| Histoire page names the founder and mentions cofounders | Open question F-04, unchanged by this round. |
| Pushing publishes the site | Production branch is `design/tekonest-umbrella-brand`. This work lives on `site/two-doors` and merges only on the founder's go. |
| Public repo | Brand and Rebels documents are public. Not changed here; raised separately. |
| Git ownership on the E: drive | Work happens in a clone on C: (`C:\Users\braco\dev\tekonest-site`) to avoid global git setting changes. |
| Case-colliding logo SVGs | Three files under `design/09-logo-nest/` show as modified on Windows; they are never staged. |
