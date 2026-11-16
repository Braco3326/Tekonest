import {
  type Block,
  PAGE_DRAFT_MARK,
  PAGE_IS_DRAFT,
  PRIVACY_CONTACT,
  PRIVACY_INCLUDES,
  PRIVACY_INTRO,
  PRIVACY_PAGE_DESCRIPTION,
  PRIVACY_PAGE_PATH,
  PRIVACY_PAGE_TITLE,
  PRIVACY_UPDATED,
  type PrivacyIncludes,
  policySections,
} from '../src/accounts/privacyPolicy'

/**
 * Renders the public privacy page (src/accounts/privacyPolicy.ts) to one static HTML document. Pure: same input, same string; no DOM, no I/O.
 * It lives in tools/, not src/: it is a build tool, never part of the game bundle, and its /assets/ paths are the UMBRELLA site's
 * (src/assetUrl.test.ts rightly refuses an unprefixed /assets/ literal in game code).
 *
 * The page is served by the umbrella site at /tekpractice/confidentialite/ and reuses the site's own stylesheets, fonts, favicon and
 * menu script with ROOT-ABSOLUTE paths (/assets/…), the way the site's pages use them. No external request: no font, script, image or
 * audience measurement from another host, no cookie. The only absolute link is https://www.cnil.fr (the complaint authority). The header and
 * footer mirror the umbrella layout (website-prototype/tools/build.mjs) without its prototype banner and its dated fine print, which
 * belong to the umbrella owner.
 */

export interface RenderOptions {
  includes?: PrivacyIncludes
  draft?: boolean
}

/** The umbrella site's narrow no-break space rule (website-prototype/tools/build.mjs): before ; : ! ? » and after «. Text only. */
export const NNBSP = ' '
export function frenchTypography(text: string): string {
  return text.replace(/\s+([;:!?»])/g, `${NNBSP}$1`).replace(/«\s*/g, `«${NNBSP}`)
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One string of the data -> inline HTML: escape, French spacing, **bold**, the contact address and cnil.fr as links. */
export function inline(text: string): string {
  let h = escapeHtml(frenchTypography(text))
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  h = h.split(PRIVACY_CONTACT).join(`<a href="mailto:${PRIVACY_CONTACT}">${PRIVACY_CONTACT}</a>`)
  h = h.replace(/\(cnil\.fr\)/g, '(<a href="https://www.cnil.fr">cnil.fr</a>)')
  return h
}

/** The plain text of one data string (no markup), for tests and search. */
export const plain = (text: string): string => text.replace(/\*\*/g, '')

function block(b: Block, indent: string): string {
  if (b.kind === 'p') return `${indent}<p>${inline(b.text)}</p>`
  if (b.kind === 'ul') return `${indent}<ul>\n${b.items.map((i) => `${indent}  <li>${inline(i)}</li>`).join('\n')}\n${indent}</ul>`
  const [h1, h2, h3] = b.head
  const rows = b.rows
    .map(
      ([a, c, d]) =>
        `${indent}    <tr>\n${indent}      <th scope="row">${inline(a)}</th>\n${indent}      <td data-label="${escapeHtml(h2)}">${inline(c)}</td>\n${indent}      <td data-label="${escapeHtml(h3)}">${inline(d)}</td>\n${indent}    </tr>`
    )
    .join('\n')
  return [
    `${indent}<table class="board policy-table">`,
    `${indent}  <caption>${inline(b.caption)}</caption>`,
    `${indent}  <thead>`,
    `${indent}    <tr><th scope="col">${inline(h1)}</th><th scope="col">${inline(h2)}</th><th scope="col">${inline(h3)}</th></tr>`,
    `${indent}  </thead>`,
    `${indent}  <tbody>`,
    rows,
    `${indent}  </tbody>`,
    `${indent}</table>`,
  ].join('\n')
}

const NAV: [string, string][] = [
  ['/apprendre.html', 'Se former'],
  ['/creer.html', 'Créer avec nous'],
  ['/histoire.html', 'L’histoire'],
  ['/contact.html', 'Contact'],
]

/** Page-only styles: the long-form reading layout. Everything else comes from the site's tokens.css and site.css. */
const PAGE_CSS = `.policy h2 { font-size: var(--text-xl); letter-spacing: -0.015em; line-height: 1.15; margin: 0 0 var(--space-4); scroll-margin-top: 96px; }
.policy section + section { margin-top: var(--space-7); }
.policy ul { max-width: var(--measure); margin: 0 0 var(--space-4); padding-left: 1.25em; }
.policy li { margin-bottom: var(--space-2); }
.policy .board { margin-block: var(--space-4) var(--space-5); max-width: 60rem; }
.policy .board tbody th { white-space: normal; }
.policy .board tbody th a { border-bottom: 0; text-decoration: underline; }
.policy a { overflow-wrap: anywhere; }
.policy-meta { margin-top: var(--space-4); color: var(--color-ink-2); }
.policy-back { margin-top: var(--space-4); }`

/** The full HTML document. Default: this release (PRIVACY_INCLUDES, PAGE_IS_DRAFT). */
export function renderPrivacyPage(o: RenderOptions = {}): string {
  const includes = o.includes ?? PRIVACY_INCLUDES
  const draft = o.draft ?? PAGE_IS_DRAFT
  const heading = draft ? `${PRIVACY_PAGE_TITLE} (${PAGE_DRAFT_MARK})` : PRIVACY_PAGE_TITLE
  const sections = policySections(includes)
  const nav = (current: string | null, indent: string): string =>
    NAV.map(([href, label]) => `${indent}<li><a href="${href}"${href === current ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`).join('\n')
  const body = sections
    .map((s) => [`      <section>`, `        <h2 id="${s.id}">${inline(s.title)}</h2>`, ...s.blocks.map((b) => block(b, '        ')), '      </section>'].join('\n'))
    .join('\n')
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)} — Tekonest</title>
<meta name="description" content="${escapeHtml(frenchTypography(PRIVACY_PAGE_DESCRIPTION))}">
<meta name="robots" content="index">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/site.css">
<style>
${PAGE_CSS}
</style>
<script src="/assets/js/site.js"></script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><img src="/assets/img/lockup.svg" alt="Tekonest, accueil" width="150" height="32"></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Navigation principale">
      <ul>
${nav(null, '        ')}
      </ul>
    </nav>
  </div>
</header>
<main id="contenu">
<section class="branch-hero" aria-labelledby="titre">
  <div class="wrap">
    <h1 id="titre">${inline(heading)}</h1>
    <p class="policy-meta"><em>${inline(PRIVACY_UPDATED)}</em></p>
    <p class="lead">${inline(PRIVACY_INTRO)}</p>
    <p class="policy-back"><a href="/tekpractice.html">Retour à la page TekPractice</a></p>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="policy">
${body}
    </div>
  </div>
</section>
</main>
<footer class="site-footer">
  <div class="wrap">
    <div>
      <img src="/assets/img/lockup-reverse.svg" alt="Tekonest" width="140" height="30">
      <p>Un nid pour les métiers du son${NNBSP}: se former, créer ensemble.</p>
    </div>
    <nav aria-label="Pied de page">
      <ul>
${nav(null, '        ')}
        <li><a href="/accessibilite.html">Accessibilité</a></li>
        <li><a href="${PRIVACY_PAGE_PATH}" aria-current="page">Confidentialité de TekPractice</a></li>
      </ul>
    </nav>
  </div>
</footer>
</body>
</html>
`
}
