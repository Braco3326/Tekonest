/**
 * View cube UI helpers (Task 8): the active-face state and the coalesced,
 * change-driven updater (no per-frame work while the camera is idle).
 */
import { describe, expect, it, vi } from 'vitest'
import { capLabelTurn, CoalescedUpdate, cubeState, FACE_COPY, faceTooltip, SHOW_SIDE_HINT } from '../../src/ui/viewCube'
import { ALL_FACES, cubeCssRotation, faceAngles } from '../../src/camera/viewCube'

describe('cubeState (which face is active)', () => {
  it('names the face of each named pose, with its copy-deck label', () => {
    for (const f of ALL_FACES) {
      const a = faceAngles(f)
      const s = cubeState(a.alpha, a.beta, Math.PI / 2)
      expect(s.face).toBe(f)
      expect(s.label).toBe(FACE_COPY[f].label)
    }
  })

  it('a between pose snaps to the nearest named view', () => {
    expect(cubeState(Math.PI / 2 + 0.2, 1.1, Math.PI / 2).face).toBe('face')
    expect(cubeState(Math.PI / 2, 0.1, Math.PI / 2).label).toBe('Dessus')
  })

  it('copy deck labels and accessible names (viewCube.face.*, viewCube.corner.*)', () => {
    expect(FACE_COPY.face).toMatchObject({ label: 'Face', aria: 'Vue de face' })
    expect(FACE_COPY.arriere).toMatchObject({ label: 'Arrière', aria: 'Vue arrière' })
    expect(FACE_COPY.gauche).toMatchObject({ label: 'Gauche', aria: 'Vue de gauche' })
    expect(FACE_COPY.droite).toMatchObject({ label: 'Droite', aria: 'Vue de droite' })
    expect(FACE_COPY.dessus).toMatchObject({ label: 'Dessus', aria: 'Vue de dessus' })
    expect(FACE_COPY.dessous).toMatchObject({ label: 'Dessous', aria: 'Vue de dessous' })
    expect(FACE_COPY['face-gauche'].aria).toBe('Vue de trois quarts, face-gauche')
    expect(FACE_COPY['arriere-droite'].label).toBe('Arrière-droite')
  })
})

describe('face tooltips (jardin / cour hint disabled: rooms render mirrored, ADR-0011-nav)', () => {
  it('no tooltip mentions jardin or cour, with or without a room', () => {
    expect(SHOW_SIDE_HINT).toBe(false)
    for (const f of ALL_FACES)
      for (const hasRoom of [true, false]) {
        const t = faceTooltip(f, 'Numpad 3', hasRoom)
        expect(t, `${f} room=${hasRoom}`).not.toMatch(/jardin|cour/i)
        expect(t.startsWith(FACE_COPY[f].aria)).toBe(true)
      }
    expect(faceTooltip('face', 'Numpad 1', true)).toBe('Vue de face (Numpad 1)')
    expect(faceTooltip('dessous', null, true)).toBe('Vue de dessous')
  })
})

describe('capLabelTurn: Dessus / Dessous labels always read upright', () => {
  type M = number[][]
  const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)))
  const d = Math.PI / 180
  // CSS rotation matrices (x right, y down, z toward the viewer).
  const RX = (t: number): M => [[1, 0, 0], [0, Math.cos(t * d), -Math.sin(t * d)], [0, Math.sin(t * d), Math.cos(t * d)]]
  const RY = (t: number): M => [[Math.cos(t * d), 0, Math.sin(t * d)], [0, 1, 0], [-Math.sin(t * d), 0, Math.cos(t * d)]]
  const RZ = (t: number): M => [[Math.cos(t * d), -Math.sin(t * d), 0], [Math.sin(t * d), Math.cos(t * d), 0], [0, 0, 1]]
  const F = Math.PI / 2

  for (const [name, off] of [['face', 0], ['droite', Math.PI / 2], ['arriere', Math.PI], ['gauche', -Math.PI / 2], ['off-grid', 0.3]] as const) {
    it(`heading ${name}: the label's x axis lands on screen +x`, () => {
      const alpha = F + off
      const { ry } = cubeCssRotation(alpha, Math.PI / 2, F)
      // Top view: cube RX(−90)·RY(ry); top face RX(90); label RZ(turn).
      const top = mul(mul(mul(RX(-90), RY(ry)), RX(90)), RZ(capLabelTurn('dessus', alpha, F)))
      expect(top[0][0]).toBeGreaterThan(0.95) // label x → screen x
      expect(top[1][1]).toBeGreaterThan(0.95) // label y (down) → screen down
      const bottom = mul(mul(mul(RX(90), RY(ry)), RX(-90)), RZ(capLabelTurn('dessous', alpha, F)))
      expect(bottom[0][0]).toBeGreaterThan(0.95)
      expect(bottom[1][1]).toBeGreaterThan(0.95)
    })
  }

  it('turns only by whole quadrants', () => {
    expect(capLabelTurn('dessus', F, F)).toBe(0)
    expect(capLabelTurn('dessus', F + Math.PI, F)).toBe(180)
    expect([90, 270]).toContain(capLabelTurn('dessus', F + Math.PI / 2, F))
  })
})

/** A camera.onViewMatrixChangedObservable stand-in. */
class FakeObservable {
  cbs = new Set<() => void>()
  add(cb: () => void): () => void {
    this.cbs.add(cb)
    return cb
  }
  remove(o: unknown): boolean {
    return this.cbs.delete(o as () => void)
  }
  notify(): void {
    for (const cb of this.cbs) cb()
  }
}

describe('CoalescedUpdate', () => {
  const setup = () => {
    const signal = new FakeObservable()
    const frames: FrameRequestCallback[] = []
    const raf = vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    const caf = vi.fn()
    const update = vi.fn()
    const u = new CoalescedUpdate(signal, update, raf, caf)
    const flush = (): void => {
      const run = frames.splice(0)
      for (const f of run) f(0)
    }
    return { signal, raf, caf, update, u, flush, frames }
  }

  it('does nothing at all while no change is signalled (no rAF loop)', () => {
    const { raf, update, u, flush } = setup()
    u.start()
    flush()
    flush()
    expect(raf).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('many changes in one frame → one rAF, one update', () => {
    const { signal, raf, update, u, flush } = setup()
    u.start()
    signal.notify()
    signal.notify()
    signal.notify()
    expect(raf).toHaveBeenCalledTimes(1)
    flush()
    expect(update).toHaveBeenCalledTimes(1)
    flush()
    expect(update).toHaveBeenCalledTimes(1) // no self-rescheduling
    signal.notify()
    flush()
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('stop() detaches from the camera and cancels a pending frame', () => {
    const { signal, caf, update, u, flush } = setup()
    u.start()
    signal.notify()
    u.stop()
    expect(caf).toHaveBeenCalledTimes(1)
    expect(signal.cbs.size).toBe(0)
    signal.notify()
    flush()
    expect(update).not.toHaveBeenCalled()
  })

  it('start() is idempotent (one observer)', () => {
    const { signal, u } = setup()
    u.start()
    u.start()
    expect(signal.cbs.size).toBe(1)
  })
})
