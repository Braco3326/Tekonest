/**
 * View cube UI helpers (Task 8): the active-face state and the coalesced,
 * change-driven updater (no per-frame work while the camera is idle).
 */
import { describe, expect, it, vi } from 'vitest'
import { CoalescedUpdate, cubeState, FACE_COPY } from '../../src/ui/viewCube'
import { ALL_FACES, faceAngles } from '../../src/camera/viewCube'

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
