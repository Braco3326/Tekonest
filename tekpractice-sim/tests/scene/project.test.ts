import { describe, expect, it } from 'vitest'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { projectToScreen } from '../../src/scene/project'

function setup(rect = { left: 10, top: 20, width: 400, height: 300 }) {
  const engine = new NullEngine({ renderWidth: 800, renderHeight: 600, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 })
  const scene = new Scene(engine)
  const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene)
  scene.activeCamera = cam
  scene.render()
  const canvas = { getBoundingClientRect: () => rect } as unknown as HTMLCanvasElement
  return { engine, scene, cam, canvas }
}

describe('projectToScreen (extracted from game.ts project())', () => {
  it('the camera target lands at the centre of the canvas rect (CSS px)', () => {
    const { engine, scene, cam, canvas } = setup()
    const p = projectToScreen(Vector3.Zero(), scene, cam, engine, canvas)!
    expect(p.x).toBeCloseTo(10 + 200, 6)
    expect(p.y).toBeCloseTo(20 + 150, 6)
  })
  it('points on either side of the target land on either side of the centre; up is up', () => {
    const { engine, scene, cam, canvas } = setup()
    const right = projectToScreen(new Vector3(1, 0, 0), scene, cam, engine, canvas)!
    const left = projectToScreen(new Vector3(-1, 0, 0), scene, cam, engine, canvas)!
    expect(Math.sign(right.x - 210)).toBe(-Math.sign(left.x - 210))
    const up = projectToScreen(new Vector3(0, 1, 0), scene, cam, engine, canvas)!
    expect(up.y).toBeLessThan(170)
  })
  it('null when the canvas has no render size', () => {
    const engine = new NullEngine({ renderWidth: 0, renderHeight: 0, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 })
    const scene = new Scene(engine)
    const cam = new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) } as unknown as HTMLCanvasElement
    expect(projectToScreen(Vector3.Zero(), scene, cam, engine, canvas)).toBeNull()
  })
})
