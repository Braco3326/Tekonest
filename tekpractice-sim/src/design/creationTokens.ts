/**
 * Mode Création design tokens (brief §2, P11; owner: tekdesigner). The shell's
 * own system: Nuit chrome, Papier text, Ambre selection/active, Prune accent,
 * Tektur titles, IBM Plex Sans UI, square corners (there is deliberately no
 * radius token). Exposed as `--cr-*` custom properties by `injectCreationTokens`.
 * The legacy `TOKENS` (src/design/tokens.ts, `--tk-*`) and its look are untouched.
 *
 * Contrast (WCAG 2.1, tested in tests/creation/creationTokens.test.ts):
 * Papier/Nuit 16.1, Papier/panel 15.2, inkMuted/panel ≥ 4.5, Ambre/Nuit 7.5.
 */
export const CREATION_TOKENS = {
  color: {
    nuit: '#131114',
    papier: '#F3EDE3',
    ambre: '#DD9349',
    prune: '#612D45',
    /** Raised Nuit: panels, menubar, status bar. */
    panel: '#1C191D',
    /** Subtle divider between panels (non-text, decorative). */
    panelLine: '#3A3339',
    /** Secondary text (Papier tint), ≥ 4.5:1 on panel and Nuit. */
    inkMuted: '#B3AAA0',
    /** Error text, ≥ 4.5:1 on panel. */
    danger: '#F08A7E',
    /** Success text, ≥ 4.5:1 on panel. */
    ok: '#8CCB9B',
  },
  /** 3D look of the neutral blank room (« Salle vide neutre »): a raised floor that reads on the Nuit clear colour, a quiet 1 m grid. */
  scene: {
    floor: '#2E2830',
    gridMinor: '#463E47',
    gridMajor: '#7A5A6A',
  },
  font: {
    title: "'Tektur', 'IBM Plex Sans', system-ui, sans-serif",
    ui: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  /** px */
  size: { menubar: 32, status: 28, tree: 200, props: 260, rail: 32 },
  motion: { drawerMs: 180, flyMs: 450 },
} as const

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/** Sets every token as a `--cr-*` custom property on `root` (default: <html>). */
export function injectCreationTokens(root: HTMLElement = document.documentElement): void {
  const T = CREATION_TOKENS
  for (const [k, v] of Object.entries(T.color)) root.style.setProperty(`--cr-${kebab(k)}`, v)
  root.style.setProperty('--cr-font-title', T.font.title)
  root.style.setProperty('--cr-font-ui', T.font.ui)
  root.style.setProperty('--cr-menubar-h', `${T.size.menubar}px`)
  root.style.setProperty('--cr-status-h', `${T.size.status}px`)
  root.style.setProperty('--cr-tree-w', `${T.size.tree}px`)
  root.style.setProperty('--cr-props-w', `${T.size.props}px`)
  root.style.setProperty('--cr-rail-w', `${T.size.rail}px`)
  root.style.setProperty('--cr-drawer-ms', `${T.motion.drawerMs}ms`)
  root.style.setProperty('--cr-fly-ms', `${T.motion.flyMs}ms`)
}

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (hex: string): number => {
  const n = parseInt(hex.replace('#', ''), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG 2.1 contrast ratio between two #RRGGBB colours (1…21, order-independent). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = luminance(hexA)
  const b = luminance(hexB)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
