# Phase 6 — Visual and accessibility review

Run on 22 Oct 2026 with Playwright + Chromium against the built static files.

## What was checked

| Check | How | Result |
| --- | --- | --- |
| Every page at 375, 768 and 1440 px | Full-page screenshots in `screens/` (27 files) | Reviewed; see changes below |
| Horizontal overflow | `scrollWidth − innerWidth` on every page and width | 0 px everywhere |
| Automated accessibility | axe-core, tags wcag2a/aa, wcag21a/aa, wcag22aa, at 375 and 1440 px | **0 violations** on all 9 pages (`screens/axe-report.json`) |
| Colour contrast | WCAG formula computed for every token (see design system §2) | All text ≥ 4.5:1; non-text ≥ 3:1. Amber is decorative only |
| Keyboard focus | Tabbing through the home page | Visible 3 px sodium ring; whole-door focus outline (`screens/focus-1440.jpg`) |
| Mobile navigation | Click "Menu" at 375 px, then Esc | `aria-expanded` toggles, focus moves to the first link, Esc closes it and returns focus (`screens/menu-open-375.jpg`) |
| Without JavaScript | JS disabled at 375 px | Full menu visible, all content readable |
| Reduced motion | Screens captured with `reducedMotion: 'reduce'` | Coil shown fully drawn, no animation |
| Long French text | Branch pages at 375 px | No clipping; headings balance; narrow no-break spaces keep « ? : » on the same line |

Not done:
- a screen-reader pass (NVDA or VoiceOver);
- a 200 % zoom test;
- a real five-second test with people;
- a Lighthouse performance run.

The site is static. It loads 2 CSS files, 1 tiny JS file and 3–4 WOFF2 fonts, uses no images except SVG, and has no third-party requests.

## Changes made after review

| Issue seen | Fix |
| --- | --- |
| The Bobine logo (first draft) read as a magnifying-glass "search" icon | Redrawn as a coil hanging from a hook (`03-logos/`) |
| Board C: headline overlapped the table; a lone « : » started a line | Smaller headline; narrow no-break space before « : » |
| Board B: a stray light stripe read as a rendering error; paragraph crowded the headline | Stripe removed, spacing increased |
| Footer legal note squeezed to a narrow column; empty paper strip above the footer | Note runs full width; footer margin removed |
| TekPractice preview: the blue cable floated above the gear | Cable placed behind the devices, connecting them |
| « Comment tout se relie »: link states were small grey words | Turned into the standard status tags (dot + text) |
| Section headings too large at 1440 px (64 px) | Scale reduced to 32 → 52 px |
| Réseau page stated « jamais au pourcentage » as policy, but the founder has not confirmed it | Softened to « Un travail payé sur chaque soirée payante »; added to the founder decisions |
| Story page implied the founder alone started the learning tools and that cofounders had formally joined | First attempt was not neutral enough (caught by tekreviwer). Now: « Tekonest est porté par Oscar… », « des outils pour réviser le BTS Son sont développés », « un musicien et un DJ ont dit oui… les rôles restent à définir » |

## Second pass — independent review by **tekreviwer** (30 findings, all addressed)

| Finding | Fix |
| --- | --- |
| « gratuit » stated as fact though pricing is undecided (O-08) | Removed from the site; Apprendre h1 → « Réussir le BTS Son, pas à pas. » |
| Fair-pay rule stated as policy (F-03 open) | Framed as « Notre principe, en cours de validation » / « avec l'ambition d'une équipe payée correctement » |
| Status labels didn't map to the brand status map | New 1:1 vocabulary: Existe / En développement / En projet / À décider (design system §8) |
| « Quatre niveaux jouables en local » not re-verified | « construits, jouables d'après les tests de juillet 2026 » |
| Tutor and attestations overstated | « pas encore activé en ligne », « prototype, pas encore vérifiables » |
| Undecided brand/design choices stated as fact (« signé par Tekonest ») | Marked « Proposition » |
| New promises (pay before the night, published criteria) | Rephrased as intentions |
| « Prochaine étape » were Claude's suggestions | Column retitled « Prochaine étape proposée » |
| Disabled pseudo-links (`span role=link aria-disabled`) | Real `<button disabled>` |
| Heading jumps h1→h3 (Réseau, Organiser) | Visually hidden h2 added |
| Doors used `role=list` on a div | Real `<ul>/<li>` |
| Root README tree broken | Fixed |
| Mixed « on »/« nous », small French fixes | « nous » throughout; « plutôt que de », « occasion », « toujours rémunérés » |
| TekPractice audience creep, board wording (« collectif », « besoins recueillis ») | Audience = BTS Son students first; boards re-rendered |

`before/` keeps the first home-page captures for comparison.
