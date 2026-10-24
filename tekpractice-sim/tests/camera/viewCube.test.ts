/**
 * View cube maths (designer nav, Task 7). Pure: no Babylon, no DOM.
 * Face convention N3: "Face" = from the audience toward the stage, alpha = +π/2.
 */
import { describe, expect, it } from 'vitest'
import {
  ALL_FACES,
  cubeCssRotation,
  DESSOUS_BETA,
  DESSUS_BETA,
  FACE_BETA,
  faceAngles,
  nearestFace,
  rotate90,
  SIDE_SIGN,
  type FaceId,
} from '../../src/camera/viewCube'
import { shortestAngle } from '../../src/camera/tween'

const F = Math.PI / 2
const near = (a: number, b: number, eps = 1e-9): void => expect(Math.abs(shortestAngle(a, b))).toBeLessThan(eps)

/** Babylon ArcRotateCamera eye direction (target → eye), left-handed world. */
const eyeDir = (alpha: number, beta: number): [number, number, number] => [
  Math.cos(alpha) * Math.sin(beta),
  Math.cos(beta),
  Math.sin(alpha) * Math.sin(beta),
]
/** Babylon LookAtLH screen-right vector for that eye (cross(up, forward), normalised). */
const screenRight = (alpha: number): [number, number, number] => [-Math.sin(alpha), 0, Math.cos(alpha)]

describe('faceAngles (N3: Face = audience side, alpha = +π/2)', () => {
  it('face: alpha = front, slightly above the horizon', () => {
    const a = faceAngles('face')
    near(a.alpha, F)
    expect(a.beta).toBeCloseTo(Math.PI / 2 - 0.25, 12)
    expect(FACE_BETA).toBeCloseTo(Math.PI / 2 - 0.25, 12)
  })

  it('arriere: front + π', () => {
    near(faceAngles('arriere').alpha, F + Math.PI)
    expect(faceAngles('arriere').beta).toBe(FACE_BETA)
  })

  it('droite / gauche: a quarter turn each way, on the side named from the audience', () => {
    near(faceAngles('droite').alpha, F + SIDE_SIGN * (Math.PI / 2))
    near(faceAngles('gauche').alpha, F - SIDE_SIGN * (Math.PI / 2))
  })

  it('droite puts the camera on the screen-RIGHT of the Face view (Babylon left-handed)', () => {
    const right = screenRight(faceAngles('face').alpha)
    const eye = eyeDir(faceAngles('droite').alpha, Math.PI / 2)
    const dot = right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]
    expect(dot).toBeCloseTo(1, 9)
    const eyeG = eyeDir(faceAngles('gauche').alpha, Math.PI / 2)
    expect(right[0] * eyeG[0] + right[2] * eyeG[2]).toBeCloseTo(-1, 9)
  })

  it('three-quarter views sit half-way (front ± π/4, back ± π/4)', () => {
    near(faceAngles('face-droite').alpha, F + SIDE_SIGN * (Math.PI / 4))
    near(faceAngles('face-gauche').alpha, F - SIDE_SIGN * (Math.PI / 4))
    near(faceAngles('arriere-droite').alpha, F + SIDE_SIGN * ((3 * Math.PI) / 4))
    near(faceAngles('arriere-gauche').alpha, F - SIDE_SIGN * ((3 * Math.PI) / 4))
  })

  it('dessus: beta ≈ 0, alpha = the current alpha snapped to the nearest quadrant (relative to front)', () => {
    const d = faceAngles('dessus', F, F + 1.0)
    expect(d.beta).toBe(DESSUS_BETA)
    expect(DESSUS_BETA).toBeCloseTo(0.0001, 12)
    near(d.alpha, F + Math.PI / 2)
    near(faceAngles('dessus', F, F + 0.2).alpha, F)
    near(faceAngles('dessus', F, F - 2.9).alpha, F + Math.PI)
    near(faceAngles('dessus').alpha, F) // no current alpha: the front quadrant
  })

  it('dessous: beta ≈ π', () => {
    expect(faceAngles('dessous').beta).toBe(DESSOUS_BETA)
    expect(DESSOUS_BETA).toBeCloseTo(Math.PI - 0.0001, 12)
  })

  it('honours another frontAlpha', () => {
    near(faceAngles('face', 0.3).alpha, 0.3)
    near(faceAngles('arriere', 0.3).alpha, 0.3 + Math.PI)
  })
})

describe('nearestFace', () => {
  it('round-trips every face: nearestFace(faceAngles(f)) === f', () => {
    for (const f of ALL_FACES) {
      const a = faceAngles(f)
      expect(nearestFace(a.alpha, a.beta), f).toBe(f)
    }
  })

  it('round-trips with another frontAlpha and wrapped alphas', () => {
    for (const front of [0, 1.1, -2.5]) {
      for (const f of ALL_FACES) {
        const a = faceAngles(f, front)
        expect(nearestFace(a.alpha + 4 * Math.PI, a.beta, front), `${f}@${front}`).toBe(f)
      }
    }
  })

  it('beta thresholds: < 0.35 dessus, > π − 0.35 dessous', () => {
    expect(nearestFace(F, 0.34)).toBe('dessus')
    expect(nearestFace(F, 0.36)).toBe('face')
    expect(nearestFace(F, Math.PI - 0.34)).toBe('dessous')
  })

  it('azimuth bins are π/4 wide around each of the 8 directions', () => {
    expect(nearestFace(F + 0.3, 1.2)).toBe('face')
    expect(nearestFace(F + SIDE_SIGN * 0.5, 1.2)).toBe('face-droite')
    expect(nearestFace(F - SIDE_SIGN * 1.4, 1.2)).toBe('gauche')
  })
})

describe('rotate90', () => {
  it('snaps to the next quarter relative to front, in the asked direction', () => {
    near(rotate90(F, 1), F + Math.PI / 2)
    near(rotate90(F, -1), F - Math.PI / 2)
    near(rotate90(F + 0.3, 1), F + Math.PI / 2) // off-grid: to the next multiple, not +90
    near(rotate90(F + 0.3, -1), F)
  })

  it('wraps: four turns come back to the start', () => {
    let a = F
    for (let i = 0; i < 4; i++) a = rotate90(a, 1)
    near(a, F, 1e-9)
    let b = F
    for (let i = 0; i < 4; i++) b = rotate90(b, -1)
    near(b, F, 1e-9)
  })

  it('a nearly-aligned alpha (float noise) still moves a full quarter', () => {
    near(rotate90(F + 1e-12, 1), F + Math.PI / 2)
    near(rotate90(F - 1e-12, -1), F - Math.PI / 2)
  })
})

describe('cubeCssRotation (rotateX(rx) rotateY(ry), degrees)', () => {
  it('Face view: (≈ −14°, 0): the "Face" side looks at the viewer, tilted as the camera is', () => {
    const a = faceAngles('face')
    const r = cubeCssRotation(a.alpha, a.beta, F)
    expect(r.rx).toBeCloseTo(-14.32, 1)
    expect(Math.abs(r.ry)).toBeLessThan(1e-9)
  })

  it('ry = front − alpha (wrapped to (−180, 180]); rx = beta − 90°', () => {
    const side = cubeCssRotation(F + Math.PI / 2, Math.PI / 2, F)
    expect(side.rx).toBe(0)
    expect(side.ry).toBeCloseTo(-90, 9)
    expect(cubeCssRotation(F, 0, F).rx).toBeCloseTo(-90, 9)
    expect(cubeCssRotation(F + Math.PI, Math.PI / 2, F).ry).toBeCloseTo(180, 9)
    expect(cubeCssRotation(F + 2 * Math.PI, Math.PI / 2, F).ry).toBeCloseTo(0, 9)
  })

  /**
   * The proof: build the CSS matrix rotateX(rx)·rotateY(ry) and push each cube face's
   * outward normal through it. The face whose camera pose we are at must point at the
   * viewer (+z in CSS), for every face and several fronts.
   */
  it('for each face pose, that face of the cube points at the viewer', () => {
    const deg = Math.PI / 180
    // Cube-local outward normals (CSS frame at rest: x right, y down, z toward viewer).
    // Placement used by src/ui/viewCube.ts: face translateZ, droite rotateY(90°), gauche
    // rotateY(−90°), arriere rotateY(180°), dessus rotateX(90°), dessous rotateX(−90°).
    const normals: Record<'face' | 'arriere' | 'gauche' | 'droite' | 'dessus' | 'dessous', [number, number, number]> = {
      face: [0, 0, 1],
      droite: [1, 0, 0],
      gauche: [-1, 0, 0],
      arriere: [0, 0, -1],
      dessus: [0, -1, 0],
      dessous: [0, 1, 0],
    }
    const apply = (rx: number, ry: number, v: [number, number, number]): [number, number, number] => {
      const [x, y, z] = v
      const cy = Math.cos(ry * deg)
      const sy = Math.sin(ry * deg)
      const x1 = cy * x + sy * z
      const z1 = -sy * x + cy * z
      const cx = Math.cos(rx * deg)
      const sx = Math.sin(rx * deg)
      return [x1, cx * y - sx * z1, sx * y + cx * z1]
    }
    for (const front of [F, 0, 2]) {
      for (const f of Object.keys(normals) as (keyof typeof normals)[]) {
        const pose = faceAngles(f as FaceId, front)
        // Exactly at the face: horizontal for the side faces so the normal is (0,0,1).
        const beta = f === 'dessus' || f === 'dessous' ? pose.beta : Math.PI / 2
        const r = cubeCssRotation(pose.alpha, beta, front)
        const n = apply(r.rx, r.ry, normals[f])
        expect(n[2], `${f}@${front}`).toBeGreaterThan(0.999)
      }
    }
  })
})
