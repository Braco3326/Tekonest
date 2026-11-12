import { describe, expect, it } from 'vitest'
import { CREATION_TOKENS, contrastRatio, injectCreationTokens, type RoleColours } from '../../src/design/creationTokens'
import { DESIGN_IDS, packageById } from '../../src/design/packages'

const C = CREATION_TOKENS.color

/** `top` drawn with `alpha` over `under` (sRGB blend), as '#RRGGBB'. */
function blend(top: string, under: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  return `#${[0, 1, 2]
    .map((i) => Math.round(alpha * ch(top, i) + (1 - alpha) * ch(under, i)).toString(16).padStart(2, '0'))
    .join('')}`
}

describe('creation tokens (brief §2, P11)', () => {
  it('the four brand colours are exact', () => {
    expect(C.nuit).toBe('#131114')
    expect(C.papier).toBe('#F3EDE3')
    expect(C.ambre).toBe('#DD9349')
    expect(C.prune).toBe('#612D45')
  })
  it('contrastRatio follows WCAG (black on white = 21, same colour = 1)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#131114', '#131114')).toBeCloseTo(1, 5)
  })
  it('text pairs pass 4.5:1', () => {
    expect(contrastRatio(C.papier, C.nuit)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.papier, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.inkMuted, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.inkMuted, C.nuit)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.danger, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.ok, C.panel)).toBeGreaterThanOrEqual(4.5)
    // Ambre as text (active menu, shortcuts) and Nuit on an Ambre fill (selected item)
    expect(contrastRatio(C.ambre, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.nuit, C.ambre)).toBeGreaterThanOrEqual(4.5)
  })
  it('Ambre on Nuit ≥ 3:1 (focus ring, selection)', () => {
    expect(contrastRatio(C.ambre, C.nuit)).toBeGreaterThanOrEqual(3)
  })
  it('every colour is a 7-char hex', () => {
    for (const v of Object.values(C)) expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
  it('fonts and sizes', () => {
    expect(CREATION_TOKENS.font.title).toMatch(/^'Tektur'/)
    expect(CREATION_TOKENS.font.ui).toMatch(/^'IBM Plex Sans'/)
    expect(CREATION_TOKENS.size).toEqual({ menubar: 32, status: 28, tree: 200, props: 260, rail: 32 })
    expect(CREATION_TOKENS.motion).toEqual({ drawerMs: 180, flyMs: 450 })
  })
  it('Task 14b: every scene token exists and is a 7-char hex', () => {
    const S = CREATION_TOKENS.scene
    const keys = ['floor', 'gridMinor', 'gridMajor', 'wall', 'ceiling', 'zoneFill', 'zoneEdge', 'deviceBody', 'accentMixing', 'accentSource', 'accentSpeaker', 'accentInfra', 'portIn', 'portOut', 'portBidir', 'labelInk', 'labelBg', 'shadow', 'selection', 'hover']
    for (const k of keys) expect(S[k as keyof typeof S], k).toMatch(/^#[0-9A-Fa-f]{6}$/)
    const L = CREATION_TOKENS.light
    expect(L.fillSky).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(L.fillGround).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(L.keyColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    for (const v of [L.fill, L.key, L.shadowAlpha, L.portGlow, L.bodyGlow]) expect(v).toBeGreaterThan(0)
  })
  it('Task 14b: scene contrast (dark, low-saturation, devices and ports stand out)', () => {
    const S = CREATION_TOKENS.scene
    expect(contrastRatio(S.floor, C.nuit)).toBeGreaterThanOrEqual(1.3)
    expect(contrastRatio(S.deviceBody, S.floor)).toBeGreaterThanOrEqual(2)
    for (const p of [S.portIn, S.portOut, S.portBidir]) {
      expect(contrastRatio(p, S.deviceBody)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(p, S.floor)).toBeGreaterThanOrEqual(3)
    }
    // text drawn in the scene: label ink on its card and on the floor
    expect(contrastRatio(S.labelInk, S.labelBg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(S.labelInk, S.floor)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(S.zoneEdge, S.zoneFill)).toBeGreaterThanOrEqual(2.5)
    // family tints stay subtle: close to the body, never a saturated box
    for (const a of [S.accentMixing, S.accentSource, S.accentSpeaker, S.accentInfra]) {
      expect(a).not.toBe(S.deviceBody)
      expect(contrastRatio(a, S.deviceBody)).toBeLessThanOrEqual(1.6)
    }
    // selection = the shell's Ambre, readable on the floor, distinguishable from hover
    expect(S.selection).toBe(C.ambre)
    expect(contrastRatio(S.selection, S.floor)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(S.hover, S.floor)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(S.selection, S.hover)).toBeGreaterThanOrEqual(1.5)
  })
  it('Task 17: view cube look (lifted Nuit body, Papier labels, Ambre hover, 120 / 130 px)', () => {
    const K = CREATION_TOKENS.cube
    expect(K.label).toBe(C.papier)
    expect(K.halo).toBe(C.nuit)
    expect(K.hover).toBe(C.ambre)
    expect([K.sizePx, K.sizeWidePx, K.wideFromPx, K.marginPx]).toEqual([120, 130, 1600, 16])
    expect(K.hoverAlpha).toBeGreaterThan(0)
    expect(K.hoverAlpha).toBeLessThan(1)
    // Fix 1: the body is lifted off the Nuit clear colour, shaded per face for volume (top > sides > bottom)
    const lum = (h: string) => contrastRatio(h, '#000000')
    expect(lum(K.bodyTop)).toBeGreaterThan(lum(K.body))
    expect(lum(K.body)).toBeGreaterThan(lum(K.bodyBottom))
    expect(lum(K.bodyBottom)).toBeGreaterThan(lum(C.nuit))
    for (const body of [K.bodyTop, K.body, K.bodyBottom]) {
      // text: Papier ink on its Nuit halo, whatever lies under the halo (body or hover patch)
      expect(contrastRatio(K.label, body), body).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(K.edge, body), body).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(K.ring, C.nuit)).toBeGreaterThanOrEqual(3)
      // the hover patch, alpha-blended (sRGB, as Babylon blends) over each face: a state cue ≥ 3:1 (WCAG 1.4.11)
      expect(contrastRatio(blend(K.hover, body, K.hoverAlpha), body), body).toBeGreaterThanOrEqual(3)
    }
    expect(contrastRatio(K.label, K.halo)).toBeGreaterThanOrEqual(4.5)
  })
  it('no radius token exists (square corners)', () => {
    expect(JSON.stringify(CREATION_TOKENS)).not.toMatch(/radius/i)
  })
})

/** A root that records `setProperty` (vitest runs in `node`: no DOM). */
function fakeRoot(): { root: HTMLElement; props: Map<string, string> } {
  const props = new Map<string, string>()
  const root = { style: { setProperty: (k: string, v: string) => void props.set(k, v) } } as unknown as HTMLElement
  return { root, props }
}

/**
 * T4.2 characterization (it passes on the code before T4.2): with no package, `injectCreationTokens` writes EXACTLY these `--cr-*` values (the table below was read from the
 * code at c51dc87's successor, before the role tokens). Every name here must keep its value on the plain address (and on an exam address).
 */
const TODAY: readonly (readonly [string, string])[] = [
  ['--cr-nuit', '#131114'],
  ['--cr-papier', '#F3EDE3'],
  ['--cr-ambre', '#DD9349'],
  ['--cr-prune', '#612D45'],
  ['--cr-panel', '#1C191D'],
  ['--cr-panel-line', '#3A3339'],
  ['--cr-ink-muted', '#B3AAA0'],
  ['--cr-danger', '#F08A7E'],
  ['--cr-ok', '#8CCB9B'],
  ['--cr-font-title', "'Tektur', 'IBM Plex Sans', system-ui, sans-serif"],
  ['--cr-font-ui', "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"],
  ['--cr-menubar-h', '32px'],
  ['--cr-status-h', '28px'],
  ['--cr-tree-w', '200px'],
  ['--cr-props-w', '260px'],
  ['--cr-rail-w', '32px'],
  ['--cr-drawer-ms', '180ms'],
  ['--cr-fly-ms', '450ms'],
]

describe('T4.2: injectCreationTokens (roles)', () => {
  it('CHARACTERIZATION: with no package every token that existed keeps exactly its value', () => {
    const { root, props } = fakeRoot()
    injectCreationTokens(root)
    for (const [k, v] of TODAY) expect(props.get(k), k).toBe(v)
  })

  it('no package: the resolved role tokens are today\'s Ambre / Nuit (focus, select, accent, hover text, band)', () => {
    const { root, props } = fakeRoot()
    injectCreationTokens(root)
    expect(props.get('--cr-focus')).toBe(C.ambre)
    expect(props.get('--cr-select')).toBe(C.ambre)
    expect(props.get('--cr-accent')).toBe(C.ambre)
    expect(props.get('--cr-accent-ink')).toBe(C.nuit)
    expect(props.get('--cr-accent-edge')).toBe(C.ambre)
    expect(props.get('--cr-accent-text')).toBe(C.ambre)
    expect(props.get('--cr-band')).toBe(C.panel)
    expect(props.get('--cr-band-ink')).toBe(C.papier)
  })

  it('no package: the role sources (--cr-role-*) are the plain map: panel surface, Nuit ground, Papier ink', () => {
    const { root, props } = fakeRoot()
    injectCreationTokens(root)
    expect(props.get('--cr-role-ground')).toBe(C.nuit)
    expect(props.get('--cr-role-surface')).toBe(C.panel)
    expect(props.get('--cr-role-inset')).toBe(C.nuit)
    expect(props.get('--cr-role-ink')).toBe(C.papier)
    expect(props.get('--cr-role-focus')).toBe(C.ambre)
    expect(props.get('--cr-role-danger')).toBe(C.danger)
  })

  it('package 3 resolves its focus role to Nuit and its selection to Prune, and leaves the chrome tokens at today\'s Ambre', () => {
    const { root, props } = fakeRoot()
    injectCreationTokens(root, packageById(3).colours)
    expect(props.get('--cr-role-focus')).toBe(C.nuit)
    expect(props.get('--cr-role-select')).toBe(C.prune)
    expect(props.get('--cr-role-surface')).toBe(C.papier)
    expect(props.get('--cr-role-ink')).toBe(C.nuit)
    // the menubar and the status bar stay Nuit / panel (spec 7.3): the tokens they read are not the package's
    expect(props.get('--cr-focus')).toBe(C.ambre)
    expect(props.get('--cr-accent-text')).toBe(C.ambre)
    for (const [k, v] of TODAY) expect(props.get(k), k).toBe(v)
  })

  it('every package writes the same set of property names (a map never adds or drops one)', () => {
    const names = (roles?: RoleColours): string => {
      const { root, props } = fakeRoot()
      injectCreationTokens(root, roles)
      return [...props.keys()].sort().join(',')
    }
    const plain = names()
    for (const id of DESIGN_IDS) expect(names(packageById(id).colours), `package ${id}`).toBe(plain)
  })
})
