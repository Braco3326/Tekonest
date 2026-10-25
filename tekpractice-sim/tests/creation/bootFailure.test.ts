import { describe, expect, it } from 'vitest'
import { bootFailureView, TWO_D_HREF } from '../../src/creation/bootFailure'
import { decideRoute } from '../../src/routing'
import { decideRenderer } from '../../src/render/detect'

describe('boot failure notice (Phase 1 review, Important 1)', () => {
  it('no WebGL: « Vue 3D indisponible » with a link to the 2D version', () => {
    const v = bootFailureView('no-webgl')
    expect(v.title).toBe('Vue 3D indisponible')
    expect(v.action).toEqual({ kind: 'link', label: 'Ouvrir la version 2D', href: TWO_D_HREF })
  })
  it('the 2D link lands on the legacy 2D board, even on a machine that HAS WebGL', () => {
    const search = new URL(TWO_D_HREF, 'http://x/').search
    expect(decideRoute(search, { levels: false })).toBe('legacy')
    const p = new URLSearchParams(search)
    expect(p.get('level')).toBe('a1')
    expect(
      decideRenderer({ param: p.get('render'), stored: '3d', webgl: true, cores: 8, memory: 8 })
        .use2d
    ).toBe(true)
  })
  it('a load failure: « Recharger la page »', () => {
    const v = bootFailureView('load')
    expect(v.title).toBe('Le Mode Création n’a pas pu se charger')
    expect(v.action).toEqual({ kind: 'reload', label: 'Recharger la page' })
  })
})
