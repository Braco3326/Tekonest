# Tekonest, Phase C: adapting the Berghain model (sections, text and design together)

Status: approved by the founder and built on branch `site/theme`, 29 Oct 2026 (plan `2026-10-29-tekonest-berghain-phase-c.md`). It builds on section 9 of `2026-10-28-tekonest-two-doors-design.md` (the marquetry as a CSS theme, never as pictures) and on the report `E:\CLAUDE BU\reports\Minimalist website templates and examples.md` (the founder chose Berghain from its shortlist). Method: expert council (information architect, venue-identity art director, French UX writer, neutral, validator; one challenge round).

## 1. What Berghain actually is (checked on 29 Oct 2026)

- One list of dated rows, grouped by state ("Next up", then "Soon"); each row is weekday, date, title, place. Almost no prose.
- A very short menu (Program, Shop, Awareness, Location) and small-print blocks (Location, Label, Jobs, Legal).
- A closed system: five type sizes (13, 14, 16, 19, 26 px), a seven-step grey ramp from `#141414` to `#f7f7f7`, grids of 2, 3, 4 and 8 columns, breakpoints at 40, 48, 64, 90 and 100 em, hardly any ornament.
- The structure survives with every image removed, which is the property Tekonest needs.

## 2. Decisions

| # | Decision |
| --- | --- |
| 23 | **One canonical list, grouped by state.** The home page's status index replaces the repetition of the same three facts in the doors, the status table and the closing band. Maturity is shown by the group a row sits in, not by badges on every card. |
| 24 | **Two equal doors, above the fold, in the hero field**: same width, same structure (number, name, who it is for, one sentence, status, one action), side by side from 48 em and stacked below. Equal weight in layout; the honest difference in maturity is carried by the status. |
| 25 | **Keep the top bar** (two doors first, then *L'histoire* and *Contact* quieter). Berghain's rail is not copied: it would make the second audience secondary. |
| 26 | **A closed status vocabulary of four labels, defined once on the home page** and used everywhere: *Version d'essai* (usable now, unfinished), *En développement* (being built, not open), *En projet* (an intention, nothing promised), *À venir* (planned after something else). Each keeps its glyph so colour is never the only cue. The footer wording changes to match. |
| 27 | **Six type sizes, no more** (label, small, body, lede, section title, page title) and no new font. Numerals use Tektur; tables use tabular digits. |
| 28 | **Ornament budget: two ornament types per viewport.** The frame family (wire frame and nested fillets) counts as one type; the bands (rope, triangle, sawtooth) as a second; the roundel is the footer's. |
| 29 | **Plain statement before poetry.** The home lead says what Tekonest is; "des fils tressés" leaves the lead and the thread image lives only in the *Sept fils* section. |
| 30 | **Internal commentary and dead controls leave the public pages**: the line « Proposition : la plateforme garderait son visuel sombre… », the CSS mock of the platform preview, the disabled « Accès bientôt disponible » button, and five identical « Nouveau » badges on TekPractice. |

## 3. What is borrowed and what is not

| Borrowed from Berghain | Adapted as |
| --- | --- |
| Rows grouped by state, with a legend-free reading order | The home status index: *Déjà là*, *En construction*, *Ensuite* |
| A fixed row grid (number, title, audience, state, next step) | `.index` table, stacked with `data-label` below 48 em |
| A closed type scale and a few greys | Six sizes; the existing ink and ground tokens (no new colours) |
| A very short menu and small-print blocks | Four menu items; footer in three small-print columns |
| Almost no ornament | Two ornament types per viewport |
| **Not borrowed** | **Why** |
| The left rail and the second audience in a quiet corner | The doors are equal |
| The wide banner illustration and shop thumbnails | No pictures |
| The club tone (all caps, terse, event listings) | Tekonest speaks plainly to students and project owners |
| Red as the single accent | Amber, only on Nuit, is already the wire |

## 4. System rules

- **Grid:** container 1200 px, 12 columns. Breakpoints: 40 em (two columns for small lists), 48 em (doors side by side, tables as tables), 64 em (full grids). Replaces the mixed 720, 760 and 800 px queries.
- **Type scale (tokens):** label `0.8125rem` 500 uppercase with tracking; small `0.875rem`; body `1.0625rem`; lede `1.25rem`; section title `clamp(1.75rem, 1.2rem + 2vw, 2.5rem)`; page title `clamp(2.25rem, 1.4rem + 3.6vw, 3.75rem)`. `--text-xl`, `--text-3xl` and `--text-hero` are retired by mapping to these.
- **Rows:** hairline separators (`--color-line`), the whole title is the link, minimum 44 px target, hover tints the row, no arrows, no shadows.
- **Colour:** unchanged tokens. Amber only on Nuit; plum only as small fills; pearl only as band tooth. Status text is ink with a glyph.
- **Accessibility:** 4.5:1 for text, 3:1 for large text and glyphs; targets at least 24 px (44 px used); bands hidden under `forced-colors` and in print, frames fall back to borders; reduced motion keeps the single 140 ms row tint off; no disabled buttons; every link text is unique on its page.

## 5. Page by page (sections in order, copy, components)

French copy is final text for review; typography (narrow no-break spaces) is applied by the build.

### 5.1 Home (`index.html`)

1. **Hero field** (Nuit, wire frame; the statement is left-aligned to the 12-column container, as in Berghain, with the doors below it). Eyebrow « Paris · métiers du son ». H1 « Un nid pour les métiers du son. » Lead **« Deux entrées : se former au son, ou créer un projet avec nous. »** Honest line **« Tekonest se construit pas à pas. Rien n'est encore en vente : chaque ligne de cette page dit ce qui existe et ce qui se prépare. »**
   Then **two door panels**, nested fillets in the dark variant:

   | | 01 | 02 |
   | --- | --- | --- |
   | Name (link) | Se former | Créer avec nous |
   | For whom | Étudiantes et étudiants en BTS Son | Porteuses et porteurs de projet : spectacle, film, événement |
   | Sentence | Réussir le BTS Son avec la plateforme Apprendre, et s'entraîner à câbler du vrai matériel sur TekPractice. | Composition sonore, prise de son, live, direction artistique, mixage et mastering, au service de votre projet. |
   | Status | En développement | En projet |
   | Action | Jouer à TekPractice (version d'essai) | Écrire pour un projet |

   Rope band below. The « Les deux entrées » anchor button is removed (the doors are already on screen).
2. **« Où nous en sommes »** (Crème). Line « Mis à jour le {date de la page}. » (one source: the build date). Legend, once, as a short definition list of the four labels (see decision 26). One table, three groups:

   | Group | Name | For whom | State | Next step |
   | --- | --- | --- | --- | --- |
   | Déjà là | TekPractice | Étudiants en BTS Son | Version d'essai | Terminer le mode Création. |
   | En construction | Apprendre | Étudiants en BTS Son | En développement | Vérifier le cours E3 et préparer les autres épreuves. |
   | Ensuite | Créer avec nous | Porteuses et porteurs de projet | En projet | Préciser l'offre avec les premières demandes. |
   | Ensuite | Cours des autres épreuves | Étudiants en BTS Son | À venir | Après la relecture du cours E3. |
   | Ensuite | TekPractice dans le cours E4 | Étudiants en BTS Son | À venir | Après le mode Création. |
3. **« Sept fils, sept métiers. »** (Papier, so two tinted sections never stack). One sentence: « Le nid a sept fils : les sept métiers avec lesquels Tekonest veut travailler. » Seven rows (number, name, one line) with the small mark; this is the page's signature element. The marquetry sentence moves to *L'histoire*.
4. **Closing band** (triangle band above, Nuit, wire frame): text unchanged (« Ce que vous pouvez faire aujourd'hui… », « Écrire à Tekonest », « Lire l'histoire »).

Ornament types on screen: first screen frame + rope band (2); status index none; seven fils the marks (1); closing triangle band + wire frame (2); footer sawtooth + roundel (2).

### 5.2 Se former (`apprendre.html`)

1. Hero: status « En développement », H1 and lead unchanged; rope band.
2. « Ce qui existe déjà »: the four existing items as rows (cours E3 en prototype; index de 18 annales; tuteur IA programmé mais pas encore activé; attestations en prototype, pas encore vérifiables). **The CSS platform mock and the line « Proposition : … » are removed.**
3. « Ce qui se prépare »: the three existing items as rows.
4. « Accès à la plateforme » (Crème): the text « Le lien public sera indiqué ici dès qu'une version relue sera en ligne. Le nom définitif de la plateforme reste à choisir. » **The disabled button becomes a plain line** « Pas encore ouvert. » with a link « Nous écrire ».

### 5.3 Créer avec nous (`creer.html`)

1. Triangle band, hero (status « Offre en projet », H1 and lead unchanged), rope band.
2. « Ce que nous pouvons faire avec vous »: intro **« Quatre manières de travailler ensemble. Toutes sont encore en projet : dites-nous ce dont votre projet a besoin. »** Four numbered rows, **no repeated badge** (the status is said once, in the hero and the intro).
3. « Comment ça se passe » (Crème): the four steps, unchanged.
4. « Un projet en tête ? » with « Parlez-nous de votre projet » and the existing note.

### 5.4 L'histoire, Contact, Accessibilité, TekPractice

- **L'histoire:** one new short section « Les motifs » (before the values): **« Les motifs du site (cadres, bandes, médaillon) sont inspirés de la marqueterie de Damas, faite de bois et de nacre. Ils sont dessinés par Tekonest et ne prétendent pas reproduire ce savoir-faire. »** The rest unchanged.
- **Contact, Accessibilité:** copy unchanged. **Blocker to resolve before promotion:** the contact address is still « [Adresse e-mail à définir] », so the *Créer* door's action ends in a placeholder.
- **TekPractice:** keep the hero status « Version d'essai »; the five identical « Nouveau » badges are removed (the section title already carries the date); the last row's « En préparation » becomes « À venir ». Controls tables unchanged.

### 5.5 Layout (all pages)

- Menu: *Se former*, *Créer avec nous* (equal), then *L'histoire*, *Contact* (quieter). Prototype banner unchanged.
- Footer: two link columns, *Entrées* (Se former, Créer avec nous) and *Tekonest* (L'histoire, Contact, Accessibilité), and below them the dated fine print under the small label *État*. Fine print: **« Prototype de conception, {date}. Tekonest n'a pas encore de structure juridique ; seuls les services marqués « version d'essai » sont utilisables aujourd'hui, ceux marqués « en développement », « en projet » ou « à venir » ne sont pas proposés. »** The credit line stays.

## 6. Build order (for the plan)

1. Tokens and rules: six-size type scale, breakpoint unification, `.index` and `.rows` components, status vocabulary (CSS and a closed-list test).
2. Home: hero with the two doors, status index, seven fils, closing band.
3. *Créer* and *Se former* as rows; remove the dead controls and commentary.
4. TekPractice badges, *L'histoire* « Les motifs », footer and menu.
5. Verification: tests, browser verifier with the new checks below, screenshots, one fresh whole-branch review.

## 7. Acceptance

1. Every `.status` text on every page is one of the four labels; the legend appears once, on the home page; the footer wording matches.
2. At 1440×900 both doors are fully visible without scrolling; at 390×844 the first door's name and action are visible and the second door starts within one scroll of the viewport (two stacked doors cannot both fit in 844 px). From 48 em up their widths differ by no more than 1 px.
3. No disabled `button`, no « Proposition : », no list with more than one identical badge.
4. At most six distinct font sizes in `site.css` tokens; no new font file.
5. Two ornament types per viewport on the home page (checked on the screenshots).
6. axe 0 violations and no overflow at 320, 375, 768 and 1440 px; layout shift 0; no picture loaded; the existing banned-string and credit-line tests pass.
7. The honesty rule holds: no line claims anything is available that is not.

## 8. Open

- Contact e-mail (F-05) before any promotion.
- Whether the doors in the hero should keep the wire frame around both (the art director's fallback: frame the statement only).
- Real TekPractice and E3 captures for *Se former* (the only pictures that will serve the goal).
- Legal wording and naming checks remain postponed, as decided.
