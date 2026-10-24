/** CableRenderer pulse option (Task 2): pulses default on; { pulses: false } keeps the loop idle-capable. */
import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setMotionOverride } from '../../src/design/tokens'
import { CableRenderer } from '../../src/scene/CableRenderer'
import { CableBudget } from '../../src/scene/cablePath'

describe('CableRenderer pulses option', () => {
  let engine: NullEngine
  let scene: Scene
  beforeEach(() => {
    setMotionOverride(true)
    engine = new NullEngine()
    scene = new Scene(engine)
  })
  afterEach(() => {
    scene.dispose()
    engine.dispose()
    setMotionOverride(null)
  })
  const wire = (c: CableRenderer): void => c.addCable('c1', new Vector3(0, 0, 0), new Vector3(1, 0, 0))

  it('default: a committed cable carries a pulse', () => {
    const c = new CableRenderer(scene)
    wire(c)
    expect(c.pulseCount).toBe(1)
  })
  it('{ pulses: false }: no pulse, pulseCount stays 0', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false })
    wire(c)
    expect(c.pulseCount).toBe(0)
  })
})
