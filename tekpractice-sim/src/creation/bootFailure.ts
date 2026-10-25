/**
 * The shell could not start (Phase 1 review, Important 1). Mode Création is the
 * default URL, so a computer without WebGL, or a chunk that fails to download,
 * must not leave the learner on « Choisissez un lieu pour commencer. » with
 * nothing to click. A persistent alert (`role="alert"`, no close button) says
 * why and gives the way out: the 2D board, or a reload. Its action takes focus.
 *
 * Statically imported by `main.ts` (it must render when the creation chunk itself
 * failed to load), so it stands alone: inline styles with token fallbacks, no
 * creation.css, no Babylon.
 */
import { COPY } from './copy'

export type BootFailureKind = 'no-webgl' | 'load'

/** The legacy 2D board: WebGL-free, same engine and rules (VISION: weak PCs). */
export const TWO_D_HREF = '?level=a1&render=2d'

export interface BootFailureView {
  title: string
  body: string
  action: { kind: 'link'; label: string; href: string } | { kind: 'reload'; label: string }
}

export function bootFailureView(kind: BootFailureKind): BootFailureView {
  const B = COPY.boot!
  return kind === 'no-webgl'
    ? {
        title: B.noWebglTitle!,
        body: B.noWebglBody!,
        action: { kind: 'link', label: B.open2d!, href: TWO_D_HREF },
      }
    : { title: B.loadTitle!, body: B.loadBody!, action: { kind: 'reload', label: B.reload! } }
}

const STYLE = `
.cr-boot-failure {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 100;
  width: min(32rem, calc(100vw - 32px)); padding: 24px; border-radius: 0;
  background: var(--cr-nuit, #131114); color: var(--cr-papier, #f3ede3);
  border: 1px solid var(--cr-ambre, #dd9349);
  font: 16px/1.5 var(--cr-font-ui, 'IBM Plex Sans', system-ui, sans-serif);
}
.cr-boot-failure h2 { margin: 0 0 8px; font: 600 20px/1.3 var(--cr-font-title, 'Tektur', system-ui, sans-serif); }
.cr-boot-failure p { margin: 0 0 16px; }
.cr-boot-failure-action {
  display: inline-block; padding: 8px 16px; border-radius: 0; cursor: pointer;
  background: var(--cr-ambre, #dd9349); color: var(--cr-nuit, #131114);
  border: 0; font: 600 16px/1.5 var(--cr-font-ui, 'IBM Plex Sans', system-ui, sans-serif); text-decoration: none;
}
.cr-boot-failure-action:focus-visible {
  outline: 2px solid var(--cr-ambre, #dd9349); outline-offset: 1px; box-shadow: 0 0 0 3px var(--cr-nuit, #131114);
}
`

/** Shows (or replaces) the alert. Never throws: it is the last resort. */
export function showBootFailure(
  doc: Document,
  kind: BootFailureKind,
  reload: () => void = () => location.reload()
): HTMLElement {
  const v = bootFailureView(kind)
  doc.querySelector('[data-testid="boot-failure"]')?.remove()
  if (!doc.getElementById('cr-boot-failure-style')) {
    const s = doc.createElement('style')
    s.id = 'cr-boot-failure-style'
    s.textContent = STYLE
    doc.head.appendChild(s)
  }
  const box = doc.createElement('section')
  box.className = 'cr-boot-failure'
  box.dataset.testid = 'boot-failure'
  box.setAttribute('role', 'alert')
  box.setAttribute('aria-labelledby', 'cr-boot-failure-title')
  const h = doc.createElement('h2')
  h.id = 'cr-boot-failure-title'
  h.textContent = v.title
  const p = doc.createElement('p')
  p.textContent = v.body
  let action: HTMLElement
  if (v.action.kind === 'link') {
    const a = doc.createElement('a')
    a.href = v.action.href
    action = a
  } else {
    const b = doc.createElement('button')
    b.type = 'button'
    b.addEventListener('click', () => reload())
    action = b
  }
  action.className = 'cr-boot-failure-action'
  action.textContent = v.action.label
  box.append(h, p, action)
  // Not inside an inert region (a half-mounted shell): straight under <body>.
  doc.body.appendChild(box)
  action.focus({ preventScroll: true })
  return box
}
