/**
 * RoomBuilder — Babylon geometry for a procedural room (master prompt B3).
 * Floor, door-cut walls and ceiling from roomLayout(); raised zones become
 * platforms you can step onto; flat zones get a faint floor tint so the learner
 * reads "scène / régie / public" at a glance. Walls and ceiling are single-sided
 * (facing inward): the orbit camera outside the room sees straight in.
 * Never pickable — gear and ports stay the only interactive meshes.
 */
import { Color3, HemisphericLight, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core'
import type { RoomLayout } from '../explore/roomLayout'
import type { RoomFileT } from '../explore/roomSchema'

/** Approximate light colour for a colour temperature (K) — warm stage vs cool studio. */
export function kelvinToColor(k: number): Color3 {
  const t = Math.min(1, Math.max(0, (k - 2700) / (6500 - 2700)))
  return new Color3(1, 0.82 + 0.15 * t, 0.62 + 0.38 * t)
}

const ZONE_TINT: Record<string, string> = {
  stage: '#C9A86A',
  foh: '#2E5FE6',
  'monitor-world': '#8A63D2',
  'control-room': '#2E5FE6',
  audience: '#7A8494',
  pit: '#5A4632',
}

export function buildRoom(scene: Scene, room: RoomFileT, layout: RoomLayout): TransformNode {
  const root = new TransformNode(`room:${room.id}`, scene)
  const mat = (name: string, hex: string, alpha = 1): StandardMaterial => {
    const m = new StandardMaterial(`mat:room:${name}`, scene)
    m.diffuseColor = Color3.FromHexString(hex)
    m.specularColor = Color3.Black()
    m.alpha = alpha
    m.backFaceCulling = true
    return m
  }
  const wallMat = mat('wall', room.procedural.wall_color)
  const floorMat = mat('floor', room.procedural.floor_color)
  const ceilMat = mat('ceiling', room.procedural.ceiling_color)
  const own = (m: Mesh): Mesh => {
    m.isPickable = false
    m.parent = root
    m.receiveShadows = true
    return m
  }

  // Floor and zones are orbit pivot surfaces (designer nav: double-click the
  // floor to orbit around that point). Walls and ceiling never are; for zone
  // decks only the TOP counts (FocusPatch keeps up-facing hits only).
  // Still not pickable by default picks: only FocusPatch's floor predicate looks at this flag.
  const surface = (m: Mesh): Mesh => {
    m.metadata = { ...(m.metadata ?? {}), pivotSurface: true }
    return m
  }

  const floor = surface(own(MeshBuilder.CreateGround('room:floor', { width: layout.width, height: layout.length }, scene)))
  floor.material = floorMat

  // Ceiling: a plane facing DOWN (visible from inside, culled from above).
  const ceiling = own(MeshBuilder.CreatePlane('room:ceiling', { width: layout.width, height: layout.length }, scene))
  ceiling.rotation.x = -Math.PI / 2
  ceiling.position.y = layout.height
  ceiling.material = ceilMat

  for (const [i, s] of layout.wallSegments.entries()) {
    const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0)
    const h = s.top - s.bottom
    if (len < 0.01 || h < 0.01) continue
    const plane = own(MeshBuilder.CreatePlane(`room:wall:${s.wall}:${i}`, { width: len, height: h }, scene))
    plane.position = new Vector3((s.x0 + s.x1) / 2, s.bottom + h / 2, (s.z0 + s.z1) / 2)
    // A plane's front face points −Z; rotation.y = θ turns its normal to
    // (−sin θ, 0, −cos θ). Each wall must face the room centre.
    plane.rotation.y = s.wall === 'front' ? Math.PI : s.wall === 'rear' ? 0 : s.wall === 'left' ? -Math.PI / 2 : Math.PI / 2
    plane.material = wallMat
  }

  for (const z of layout.zones) {
    const tint = ZONE_TINT[z.kind] ?? '#9AA3B2'
    if (z.y > 0.05) {
      const deck = surface(own(MeshBuilder.CreateBox(`room:zone:${z.id}`, { width: z.w, depth: z.d, height: z.y }, scene)))
      deck.position = new Vector3(z.x, z.y / 2, z.z)
      deck.material = mat(`zone:${z.id}`, tint, 1)
    } else {
      const mark = surface(own(MeshBuilder.CreateGround(`room:zone:${z.id}`, { width: z.w, height: z.d }, scene)))
      mark.position = new Vector3(z.x, 0.005, z.z)
      const markMat = mat(`zone:${z.id}`, tint, 0.12)
      // y stays 0.005: with the orbit minZ at 0.05 the mark could z-fight the floor at overview distance, so bias it forward in depth.
      markMat.zOffset = -2
      mark.material = markMat
    }
  }

  const light = new HemisphericLight(`room:light:${room.id}`, new Vector3(0, 1, 0), scene)
  light.diffuse = kelvinToColor(room.lighting.color_temp_k)
  light.intensity = 0.35
  light.parent = root
  return root
}
