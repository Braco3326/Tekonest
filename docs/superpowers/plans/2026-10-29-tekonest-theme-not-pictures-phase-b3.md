# Phase B3 Implementation Plan: the marquetry as a theme, never as pictures

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline).

**Goal:** Replace every picture of the panel on the site with CSS-defined theme components (frames, bands, wire, roundel).
**Architecture:** Motifs become rules in `assets/css/site.css`, coloured by the tokens in `tokens.css`; pages lose their image and script references; the picture pipeline leaves the site.
**Tech Stack:** static HTML fragments, `tools/build.mjs`, CSS masks and gradients, `node --test`, Playwright (verifier).
**Spec:** `docs/superpowers/specs/2026-10-28-tekonest-two-doors-design.md` section 9.

## Global Constraints
- No raster file, canvas or `panel.js` on the site. French copy, narrow no-break space typography. Honesty rule. `noindex` stays. Credit line stays.

## Review Focus
- Contrast of text on every band and field (axe); forced-colors and print do not hide content; no horizontal overflow at 320 px.
- No leftover reference to a removed file (link test).

### Task 1: Tests first
Replace the picture-based tests in `tools/site.test.mjs` with the section 9.4 rules; delete `assets.test.mjs`, `bundle.test.mjs`, `hero-panel.test.mjs`; reduce `pipeline.test.mjs` to pages.
### Task 2: CSS theme components
`.rule-rope/.rule-tri/.rule-saw`, `.cadre-nuit` (wire frame with corner squares), `.roundel`, in `site.css`; remove the tile, hero-panel, branch-hero art and seal rules.
### Task 3: Pages
Home hero and closing band, *Se former* hero, layout footer (roundel, no seal image, no og:image), tri band above the closing band.
### Task 4: Remove the pipeline from the site
Delete `assets/img/panel/`, `assets/js/panel.js`, `tools/build-visuals.mjs`, `tools/render-assets.mjs`; update `package.json`, README, `verify-browser.mjs` (hero checks become theme checks).
### Task 5: Verify and hand over
Full suite, `verify-browser`, screenshots reviewed, commit. Do not push.
