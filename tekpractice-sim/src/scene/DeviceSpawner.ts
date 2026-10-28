/**
 * DeviceSpawner — spawns a device at a position.
 * Tries public/assets/<deviceId>.glb; while absent (or on failure) the device
 * is a PLACEHOLDER BOX with labelled port markers read from the catalog.
 * Assets NEVER block gameplay: the placeholder is built synchronously, the
 * .glb (when it exists one day) replaces the visual asynchronously.
 */
import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import type { Registry, DeviceT } from '../engine/CatalogLoader'
import type { PortRef } from '../engine/types'
import { TOKENS } from '../design/tokens'
import { assetUrl } from '../assetUrl'

export interface DeviceInstance {
  instanceId: string
  deviceId: string
  root: TransformNode
  /** portId → the pickable marker mesh (metadata.portRef is set). */
  portMarkers: Map<string, Mesh>
  /** Set to 'glb' once the model loads + normalises, 'placeholder' otherwise. */
  assetStatus: 'glb' | 'placeholder'
  /** Resolves true when the .glb applied (ports re-anchored), false on fallback. */
  modelReady: Promise<boolean>
  dispose(): void
}

/** Rough placeholder footprints per realWorld.category (meters: w, h, d). */
const SIZE_BY_CATEGORY: Record<string, [number, number, number]> = {
  console: [1.0, 0.25, 0.55],
  stagebox: [0.48, 0.18, 0.4],
  microphone: [0.07, 0.22, 0.07],
  'powered-speaker': [0.4, 0.62, 0.36],
  'studio-monitor': [0.2, 0.3, 0.25],
  accessory: [0.06, 1.6, 0.06],
  signaling: [0.12, 0.28, 0.12],
  computer: [0.45, 0.45, 0.2],
  codec: [0.48, 0.09, 0.32],
  'monitor-controller': [0.26, 0.1, 0.3],
  'mic-preamp': [0.24, 0.09, 0.26],
  'master-clock': [0.48, 0.09, 0.26],
  patchbay: [0.48, 0.14, 0.22],
  cable: [0.3, 0.06, 0.12],
  'audio-interface': [0.48, 0.13, 0.3],
}
const DEFAULT_SIZE: [number, number, number] = [0.4, 0.3, 0.3]

/**
 * Real-world outer dimensions per device id (meters: w=width, h=height, d=depth).
 * Source: assets-source/ ** /notes.md (manufacturer datasheets).
 * Height is the normalisation anchor (most reliable across the glb set): the
 * imported model is scaled UNIFORMLY so its measured height matches h. Ids
 * absent here are left unscaled (see tryLoadModel). Also drives the re-anchored
 * port grid so markers sit on the real -Z face of the normalised model.
 */
const REAL_SIZE_M: Record<string, { w: number; h: number; d: number }> = {
  'shure-sm58': { w: 0.051, h: 0.162, d: 0.051 },
  'shure-sm57': { w: 0.032, h: 0.157, d: 0.032 },
  'ev-re20': { w: 0.0544, h: 0.2167, d: 0.0544 },
  'ev-re50': { w: 0.049, h: 0.197, d: 0.049 },
  'neumann-u87-ai': { w: 0.056, h: 0.2, d: 0.056 },
  'qsc-k12-2': { w: 0.356, h: 0.602, d: 0.35 },
  'yamaha-dbr12': { w: 0.376, h: 0.601, d: 0.348 },
  'genelec-8030c': { w: 0.189, h: 0.299, d: 0.178 },
  'yamaha-ql1': { w: 0.468, h: 0.272, d: 0.562 },
  'yamaha-rio3224-d2': { w: 0.48, h: 0.22, d: 0.368 },
  'axia-iq': { w: 0.521, h: 0.114, d: 0.483 },
  'avid-hd-io': { w: 0.483, h: 0.089, d: 0.305 },
  'focusrite-isa-one': { w: 0.22, h: 0.104, d: 0.29 },
  'grace-m905': { w: 0.483, h: 0.089, d: 0.432 },
  'antelope-ocx-hd': { w: 0.4826, h: 0.044, d: 0.23 },
  'aeta-scoop5-s': { w: 0.48, h: 0.044, d: 0.252 },
  'aeta-scoopy-plus-s': { w: 0.155, h: 0.08, d: 0.234 },
  'switchcraft-studiopatch-9625': { w: 0.4826, h: 0.0445, d: 0.22 },
  'km-210-9': { w: 0.6, h: 1.6, d: 0.4 },
  'avid-protools-hdx': { w: 0.2, h: 0.45, d: 0.45 },
  'playout-pc': { w: 0.2, h: 0.45, d: 0.45 },
  'yellowtec-litt': { w: 0.051, h: 0.28, d: 0.051 },
  'yellowtec-mika': { w: 0.09, h: 0.45, d: 0.787 },
  'mogami-gold-db25-xlrm': { w: 0.3, h: 0.06, d: 0.12 },
}

/** A port slot in the −Z grid: local position of its marker + its pick radius. */
interface PortSlot {
  local: Vector3
  pickDiameter: number
}

/**
 * Deterministic port grid on the camera-facing (−Z) face for a box of size
 * (w,h,d). Shared by the placeholder build and the glb re-anchor so markers,
 * pick spheres and labels land identically on both — the glb version just uses
 * the REAL dimensions instead of the rough placeholder footprint.
 */
function portGrid(n: number, w: number, h: number, d: number): PortSlot[] {
  if (n === 0) return []
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  const sx = Math.max(0.04, Math.min(0.1, w / (cols + 1)))
  const sy = Math.max(0.045, Math.min(0.1, h / (rows + 1)))
  const capX = cols > 1 ? sx * 0.95 : 0.12
  const capY = rows > 1 ? sy * 0.95 : 0.12
  const pickDiameter = Math.max(0.035, Math.min(0.12, capX, capY))
  const slots: PortSlot[] = []
  for (let i = 0; i < n; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    slots.push({
      local: new Vector3(
        (col - (cols - 1) / 2) * sx,
        h / 2 + ((rows - 1) / 2 - row) * sy,
        -d / 2 - 0.015
      ),
      pickDiameter,
    })
  }
  return slots
}

/** Offset of a port label above its marker (kept identical everywhere). */
const PORT_LABEL_OFFSET = new Vector3(0, 0.055, -0.01)

/**
 * Themed label geometry (Mode Création, Task 14b Fix 1): the device name is half the
 * legacy size, port labels are ~0.9× the name's glyph height (legacy: ~0.2×), and the
 * port grid is spaced for its labels: a label never covers a neighbour's marker.
 */
export const THEMED_LABELS = {
  /** Device name plane (m) + canvas px; glyph ≈ font / texH × h. */
  name: { w: 0.4, h: 0.1, fontPx: 44, above: 0.12 },
  /** As wide as the grid pitch: a fitted label never reaches its neighbour's. */
  port: { w: 0.26, h: 0.052, fontPx: 52 },
  /** Port grid pitch (m): a column fits a ~16-character label, a row fits marker + label. */
  pitchX: 0.26,
  pitchY: 0.1,
  /** Label centre above its marker (m): clear of this marker (r 0.025) and of the next row's. */
  offset: new Vector3(0, 0.05, -0.01),
}

/** Themed port grid: fixed pitch sized for the labels (may extend past a narrow device), never under the floor. */
function portGridThemed(n: number, h: number, d: number): PortSlot[] {
  if (n === 0) return []
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  const { pitchX: sx, pitchY: sy } = THEMED_LABELS
  const cy = Math.max(h / 2, 0.04 + ((rows - 1) / 2) * sy)
  const slots: PortSlot[] = []
  for (let i = 0; i < n; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    slots.push({
      local: new Vector3(
        (col - (cols - 1) / 2) * sx,
        cy + ((rows - 1) / 2 - row) * sy,
        -d / 2 - 0.015
      ),
      pickDiameter: 0.08,
    })
  }
  return slots
}

const DIR_COLOR: Record<string, Color3> = {
  in: Color3.FromHexString(TOKENS.color.portIn),
  out: Color3.FromHexString(TOKENS.color.portOut),
  bidir: Color3.FromHexString(TOKENS.color.portBidir),
}

/**
 * An opt-in placeholder look (Mode Création, Task 14b). Absent = the legacy
 * look, exactly (TOKENS body / ports, ink-on-white labels). A loaded .glb is
 * never recoloured: only the placeholder box, its markers, labels and shadow.
 */
export interface DeviceTheme {
  /** Box sides. */
  body: string
  /** Top-face tint for a realWorld.category (null = the body colour). */
  accentOf(category: string): string | null
  port: { in: string; out: string; bidir: string }
  /** Port marker self-illumination, share of its colour (legacy: 0.25). */
  portGlow: number
  /** Body self-illumination, share of its face colour (legacy: 0.25 of the body). */
  bodyGlow: number
  labelInk: string
  labelBg: string
  /** Canvas font family for labels (falls back to the UA sans-serif when not loaded). */
  labelFont: string
  /** Contact-shadow core colour + opacity. */
  shadow: string
  shadowAlpha: number
}

const hexToRgba = (hex: string, a: number): string => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export class DeviceSpawner {
  private materials = new Map<string, StandardMaterial>()

  constructor(
    private scene: Scene,
    private registry: Registry,
    private theme?: DeviceTheme
  ) {}

  spawn(deviceId: string, position: Vector3, instanceId = deviceId): DeviceInstance {
    const device = this.registry.deviceById.get(deviceId)
    if (!device) throw new Error(`content bug: unknown deviceId "${deviceId}"`)

    const root = new TransformNode(`dev:${instanceId}`, this.scene)
    root.position = position.clone()

    const portMarkers = this.buildPlaceholder(device, instanceId, root)

    const instance: DeviceInstance = {
      instanceId,
      deviceId,
      root,
      portMarkers,
      assetStatus: 'placeholder',
      // Reassigned below to the real load promise; typed here so the object is
      // fully-formed before tryLoadModel can flip assetStatus.
      modelReady: Promise.resolve(false),
      dispose: () => root.dispose(false, true),
    }

    // Async .glb replacement — assets NEVER block gameplay: the placeholder is
    // live immediately, the model swaps in (and re-anchors the ports) when (and
    // only when) it loads. Engine + interaction depend only on marker metadata.
    this.pending++
    instance.modelReady = this.tryLoadModel(device, instanceId, root, portMarkers, instance).finally(() => {
      this.pending-- // after the model applied (or, for a dead root, was dropped): runs before any `modelReady.then`
    })

    return instance
  }

  private pending = 0

  /**
   * .glb loads still in flight (spawned, not yet applied, dropped or failed). Zero = every model that will arrive has
   * arrived: the one signal a test (or a loader) can wait on, a nodes-in-the-scene count is not (a load creates its
   * nodes before it resolves, and a cancelled one removes them only when it does).
   */
  get pendingModels(): number {
    return this.pending
  }

  /**
   * Swap the placeholder box for public/assets/<deviceId>.glb when it exists,
   * NORMALISED to real-world scale: uniform-scaled by height, grounded (min.y=0),
   * centered on the instance origin, oriented I/O toward −Z. Then the existing
   * port markers/pick-spheres/labels are RE-ANCHORED onto the real −Z face so
   * cables land on the visible model (not the placeholder grid).
   *
   * Any failure (404, decode, Draco) keeps the box — gameplay never depends on
   * the model. Resolves true when the glb applied, false on fallback.
   */
  private tryLoadModel(
    device: DeviceT,
    instanceId: string,
    root: TransformNode,
    portMarkers: Map<string, Mesh>,
    instance: DeviceInstance
  ): Promise<boolean> {
    const deviceId = device.id
    return SceneLoader.ImportMeshAsync(null, assetUrl('assets/'), `${deviceId}.glb`, this.scene)
      .then(({ meshes }) => {
        // The instance was disposed while the model loaded (fast Essais compare
        // flips, rig load, pick-up): drop the import, never parent it to a dead
        // root (an orphan "ghost" device that nothing tracks) — final review #1.
        if (root.isDisposed()) {
          for (const m of meshes) m.dispose(false, true)
          return false
        }
        const glbRoot = meshes[0]
        glbRoot.name = `glb:${instanceId}`
        glbRoot.parent = root
        // The model is the double-click focus target too (ADR-0008).
        for (const m of meshes) {
          m.isPickable = true
          m.metadata = { ...(m.metadata ?? {}), isDeviceBody: true, instanceId }
        }

        const scale = this.normalizeModel(deviceId, glbRoot)
        this.reanchorPorts(device, instanceId, glbRoot, portMarkers)

        // THIS instance's box: a global name lookup could hit a respawned twin with the same id.
        root.getChildMeshes(true, (n) => n.name === `box:${instanceId}`)[0]?.setEnabled(false)
        instance.assetStatus = 'glb'
        console.info(
          `[assets] ${deviceId}: glb chargé (${meshes.length} meshes, scale ×${scale.toFixed(3)})`
        )
        return true
      })
      .catch((e: unknown) => {
        const reason = e instanceof Error ? e.message : String(e)
        console.info(`[assets] ${deviceId}: placeholder (échec: ${reason})`)
        return false
      })
  }

  /**
   * Normalise an imported glb IN PLACE (root-local, since the instance root only
   * translates — no rotation/scale): uniform scale by REAL height, ground min.y
   * to the instance origin, center X/Z, and rotate 180° if the ports face +Z.
   * Returns the applied scale factor (1 when the id has no known real size).
   */
  private normalizeModel(deviceId: string, glbRoot: AbstractMesh): number {
    const real = REAL_SIZE_M[deviceId]
    const origin =
      glbRoot.parent instanceof TransformNode
        ? (glbRoot.parent as TransformNode).getAbsolutePosition()
        : Vector3.Zero()

    glbRoot.computeWorldMatrix(true)
    let bounds = glbRoot.getHierarchyBoundingVectors()
    const height0 = bounds.max.y - bounds.min.y

    // (a/b) uniform scale by height — the most reliable anchor across the set.
    const scale = real && height0 > 1e-6 ? real.h / height0 : 1
    if (scale !== 1) {
      glbRoot.scaling.setAll(scale)
      glbRoot.computeWorldMatrix(true)
      bounds = glbRoot.getHierarchyBoundingVectors()
    }

    // (e) orientation: if the port empties sit on +Z, spin 180° so I/O faces −Z.
    // Applied BEFORE grounding/centering so absolute anchors follow the spin.
    const empties = glbRoot
      .getDescendants(false)
      .filter((n): n is TransformNode => n instanceof TransformNode && /port[_:]/i.test(n.name))
    if (empties.length) {
      console.info(
        `[assets] ${deviceId}: ${empties.length} empties port_* trouvés — ${empties.map((n) => n.name).join(', ')}`
      )
      let meanZ = 0
      for (const n of empties) meanZ += n.getAbsolutePosition().z - origin.z
      meanZ /= empties.length
      if (meanZ > 0) {
        glbRoot.rotation.y += Math.PI
        glbRoot.computeWorldMatrix(true)
        bounds = glbRoot.getHierarchyBoundingVectors()
      }
    }

    // (c) ground: shift so the lowest point sits at the instance origin's y.
    glbRoot.position.y -= bounds.min.y - origin.y
    // (d) center X/Z on the instance origin.
    const cx = (bounds.min.x + bounds.max.x) / 2
    const cz = (bounds.min.z + bounds.max.z) / 2
    glbRoot.position.x -= cx - origin.x
    glbRoot.position.z -= cz - origin.z
    glbRoot.computeWorldMatrix(true)
    return scale
  }

  /**
   * Re-anchor the existing port markers / pick-spheres / labels onto the model.
   * PREFERRED source: a `port_<portId>` empty exported inside the glb (the
   * sourcing rig pass places them at the REAL I/O positions) — the marker lands
   * exactly on the modeled connector. FALLBACK (glb without empties, see
   * docs/REVIEW-ME.md §10): a grid on the −Z face of the NORMALISED model.
   * Look (size/color) is untouched — only positions move.
   */
  private portEmpty(glbRoot: AbstractMesh, portId: string): TransformNode | null {
    const exact = `port_${portId}`
    let fallback: TransformNode | null = null
    for (const n of glbRoot.getDescendants(false)) {
      if (!(n instanceof TransformNode)) continue
      if (n.name === exact) return n
      if (n.name.startsWith(exact)) fallback = n // tolerate .001-style suffixes
    }
    return fallback
  }

  private reanchorPorts(
    device: DeviceT,
    instanceId: string,
    glbRoot: AbstractMesh,
    portMarkers: Map<string, Mesh>
  ): void {
    if (device.ports.length === 0) return
    const root = glbRoot.parent as TransformNode
    const real = REAL_SIZE_M[device.id]
    let w: number, h: number, d: number
    if (real) {
      ;({ w, h, d } = real)
    } else {
      const b = glbRoot.getHierarchyBoundingVectors()
      w = b.max.x - b.min.x
      h = b.max.y - b.min.y
      d = b.max.z - b.min.z
    }

    const slots = this.grid(device.ports.length, w, h, d)
    const rootOrigin =
      glbRoot.parent instanceof TransformNode
        ? (glbRoot.parent as TransformNode).getAbsolutePosition()
        : Vector3.Zero()
    device.ports.forEach((port, i) => {
      // Real I/O empty from the rigged glb wins; the grid slot is the fallback.
      const empty = this.portEmpty(glbRoot, port.portId)
      let local = slots[i].local
      if (empty) {
        empty.computeWorldMatrix(true)
        local = empty.getAbsolutePosition().subtract(rootOrigin)
      }
      const marker = portMarkers.get(port.portId)
      if (marker) {
        marker.position = local.clone()
        marker.computeWorldMatrix(true)
      }
      // Looked up under THIS instance's root (never a same-id twin elsewhere in the scene).
      const own = (name: string) => root.getChildMeshes(true, (n) => n.name === name)[0]
      const pick = own(`pick:${instanceId}:${port.portId}`)
      if (pick) {
        pick.position = local.clone()
        pick.computeWorldMatrix(true)
      }
      const label = own(`portlabel:${instanceId}:${port.portId}`)
      if (label) {
        label.position = local.add(this.labelOffset)
        label.computeWorldMatrix(true)
      }
    })
    if (this.theme)
      this.declutterLabels(
        instanceId,
        root,
        device.ports.map((p) => p.portId)
      )
  }

  /**
   * Themed, after a .glb re-anchor (Task 14b Fix 1): real connectors sit a few cm apart,
   * closer than a label is wide. Per row (markers within 3 cm in height, sorted by x),
   * neighbours alternate above / below their marker, and a label shrinks until it fits
   * twice the gap to its nearest row neighbour — labels never run into each other.
   */
  private declutterLabels(instanceId: string, root: TransformNode, portIds: string[]): void {
    const own = (name: string) =>
      root.getChildMeshes(true, (n) => n.name === name)[0] as Mesh | undefined
    const items = portIds
      .map((id) => ({
        marker: own(`port:${instanceId}:${id}`),
        label: own(`portlabel:${instanceId}:${id}`),
      }))
      .filter((it): it is { marker: Mesh; label: Mesh } => !!it.marker && !!it.label)
    const rows: (typeof items)[] = []
    for (const it of [...items].sort((a, b) => b.marker.position.y - a.marker.position.y)) {
      const row = rows.find((r) => Math.abs(r[0].marker.position.y - it.marker.position.y) < 0.03)
      if (row) row.push(it)
      else rows.push([it])
    }
    const textW = (l: Mesh): number =>
      (l.metadata?.textW as number | undefined) ?? THEMED_LABELS.port.w
    for (const row of rows) {
      row.sort((a, b) => a.marker.position.x - b.marker.position.x)
      // Stagger only a row whose neighbours are closer than their labels are wide (the themed grid never is).
      const stagger = row.some(
        (it, i) =>
          i > 0 &&
          it.marker.position.x - row[i - 1].marker.position.x <
            (textW(it.label) + textW(row[i - 1].label)) / 2
      )
      row.forEach((it, i) => {
        const gaps = [row[i - 1], row[i + 1]]
          .filter(Boolean)
          .map((n) => Math.abs(n!.marker.position.x - it.marker.position.x))
        const room = gaps.length ? (stagger ? 2 : 1) * Math.min(...gaps) * 0.95 : Infinity
        it.label.scaling.setAll(Math.min(1, room / textW(it.label)))
        const off = THEMED_LABELS.offset
        const below = stagger && i % 2 === 1
        it.label.position = it.marker.position.add(
          new Vector3(off.x, below ? -off.y : off.y, off.z)
        )
        it.label.computeWorldMatrix(true)
      })
    }
  }

  // ── placeholder box + labelled port markers ───────────────────────────────

  private buildPlaceholder(
    device: DeviceT,
    instanceId: string,
    root: TransformNode
  ): Map<string, Mesh> {
    const [w, h, d] = SIZE_BY_CATEGORY[device.realWorld.category] ?? DEFAULT_SIZE

    const theme = this.theme
    let box: Mesh
    if (theme) {
      // Sides in the body colour, the top face tinted by gear family (vertex
      // colours × a white material): one mesh, one shared material.
      const side = Color3.FromHexString(theme.body).toColor4(1)
      const top = Color3.FromHexString(
        theme.accentOf(device.realWorld.category) ?? theme.body
      ).toColor4(1)
      const faceColors = [side, side, side, side, top, side] // Babylon box faces: 4 = top
      box = MeshBuilder.CreateBox(
        `box:${instanceId}`,
        { width: w, height: h, depth: d, faceColors },
        this.scene
      )
      // Emissive is scaled by the vertex colour in the standard shader: a lift per face colour.
      box.material = this.material('body:themed', undefined, Color3.White(), theme.bodyGlow)
    } else {
      box = MeshBuilder.CreateBox(
        `box:${instanceId}`,
        { width: w, height: h, depth: d },
        this.scene
      )
      box.material = this.material('body', TOKENS.color.deviceBody)
    }
    box.parent = root
    box.position.y = h / 2
    // Focus & Patch (ADR-0008): the body is the double-click focus target.
    box.isPickable = true
    box.metadata = { isDeviceBody: true, instanceId }

    // Soft contact shadow: a radial-gradient blob on the floor grounds the
    // device on the white stage (VISION §6 "gentle contact shadows").
    this.shadowBlob(instanceId, Math.max(w, d) * 1.7, root)

    if (theme) {
      const n = THEMED_LABELS.name
      this.labelPlane(
        `label:${instanceId}`,
        device.label,
        n.w,
        n.h,
        root,
        new Vector3(0, h + n.above, 0),
        n.fontPx
      )
    } else
      this.labelPlane(
        `label:${instanceId}`,
        device.label,
        0.8,
        0.2,
        root,
        new Vector3(0, h + 0.22, 0)
      )

    // Port grid on the camera-facing (−Z) side of the box (placeholder dims).
    // The exact same grid geometry is re-applied with REAL dims once the glb
    // loads (reanchorPorts), so markers/cables track the visible model.
    const markers = new Map<string, Mesh>()
    const slots = this.grid(device.ports.length, w, h, d)
    device.ports.forEach((port, i) => {
      const { local, pickDiameter } = slots[i]
      const ref: PortRef = { instance: instanceId, port: port.portId }

      const marker = MeshBuilder.CreateCylinder(
        `port:${instanceId}:${port.portId}`,
        { diameter: 0.05, height: 0.02, tessellation: 16 },
        this.scene
      )
      marker.rotation.x = Math.PI / 2
      marker.parent = root
      marker.position = local
      marker.material = theme
        ? this.material(
            `dir:${port.dir}:themed`,
            theme.port[port.dir as keyof DeviceTheme['port']] ?? theme.port.bidir,
            undefined,
            theme.portGlow
          )
        : this.material(`dir:${port.dir}`, undefined, DIR_COLOR[port.dir])
      marker.isPickable = false

      // Invisible, enlarged pick target — capped by grid spacing ONLY along
      // axes that actually have neighbours: overlapping spheres make the ray
      // grab a neighbour port, but a lone port keeps the full comfort size.
      const pick = MeshBuilder.CreateSphere(
        `pick:${instanceId}:${port.portId}`,
        { diameter: pickDiameter },
        this.scene
      )
      pick.parent = root
      pick.position = local
      pick.visibility = 0
      pick.isPickable = true
      pick.metadata = { isPortMarker: true, portRef: ref }

      const pl = THEMED_LABELS.port
      const label = theme
        ? this.labelPlane(
            `portlabel:${instanceId}:${port.portId}`,
            port.portId,
            pl.w,
            pl.h,
            root,
            local.add(this.labelOffset),
            pl.fontPx
          )
        : this.labelPlane(
            `portlabel:${instanceId}:${port.portId}`,
            port.portId,
            0.34,
            0.085,
            root,
            local.add(PORT_LABEL_OFFSET),
            22
          )
      // Themed: port labels draw after the scene (group 1), so no marker or model part ever covers them.
      if (theme) label.renderingGroupId = 1

      markers.set(port.portId, marker)
    })
    return markers
  }

  /** Radial soft-shadow decal under the device (cheap contact shadow). */
  private shadowBlob(instanceId: string, size: number, parent: TransformNode): void {
    let tex = this.shadowTexture
    if (!tex) {
      tex = new DynamicTexture('tex:contact-shadow', { width: 256, height: 256 }, this.scene, false)
      const ctx = tex.getContext() as CanvasRenderingContext2D
      const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 126)
      const t = this.theme
      g.addColorStop(0, t ? hexToRgba(t.shadow, t.shadowAlpha) : TOKENS.color.contactShadow)
      g.addColorStop(1, t ? hexToRgba(t.shadow, 0) : 'rgba(20, 24, 32, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 256)
      tex.update()
      tex.hasAlpha = true
      this.shadowTexture = tex
    }
    const mat = new StandardMaterial(`mat:shadow:${instanceId}`, this.scene)
    mat.diffuseTexture = tex
    mat.opacityTexture = tex
    mat.emissiveColor = Color3.Black()
    mat.diffuseColor = Color3.Black()
    mat.disableLighting = true

    const blob = MeshBuilder.CreatePlane(`shadow:${instanceId}`, { size }, this.scene)
    blob.rotation.x = Math.PI / 2
    blob.parent = parent
    // A contact shadow lives on the FLOOR even when the device is elevated
    // (layout y > 0, e.g. a mic sitting on its stand) — compensate the parent.
    blob.position.y = 0.002 - parent.position.y
    blob.material = mat
    blob.isPickable = false
  }
  private shadowTexture?: DynamicTexture

  /** Port grid: the legacy one, or the themed one spaced for its labels. */
  private grid(n: number, w: number, h: number, d: number): PortSlot[] {
    return this.theme ? portGridThemed(n, h, d) : portGrid(n, w, h, d)
  }
  private get labelOffset(): Vector3 {
    return this.theme ? THEMED_LABELS.offset : PORT_LABEL_OFFSET
  }

  private labelPlane(
    name: string,
    text: string,
    wPlane: number,
    hPlane: number,
    parent: TransformNode,
    position: Vector3,
    fontPx = 44
  ): Mesh {
    const texW = 512
    const texH = Math.round((texW * hPlane) / wPlane)
    const tex = new DynamicTexture(`tex:${name}`, { width: texW, height: texH }, this.scene, false)
    const t = this.theme
    const mat = new StandardMaterial(`mat:${name}`, this.scene)
    let textW = wPlane
    if (t) {
      // Themed: LIGHT ink with a dark halo on a transparent texture (alpha = glyph
      // coverage, not luminance): no card, so neighbouring port labels never stack
      // into dark slabs, and the halo keeps the ink readable over any surface.
      const ctx = tex.getContext() as CanvasRenderingContext2D
      ctx.clearRect(0, 0, texW, texH)
      ctx.font = `bold ${fontPx}px ${t.labelFont}`
      // Long ids (up to ~19 chars) shrink to fit the plane instead of being clipped.
      const width = ctx.measureText?.(text)?.width ?? 0
      const max = texW * 0.92
      if (width > max)
        ctx.font = `bold ${Math.max(12, Math.floor((fontPx * max) / width))}px ${t.labelFont}`
      // World width of the ink (halo included), for the .glb label declutter.
      textW = width > 0 ? (Math.min(width, max) / texW) * wPlane + 0.01 : wPlane
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(3, Math.round(fontPx * 0.24))
      ctx.strokeStyle = t.labelBg
      ctx.strokeText(text, texW / 2, texH / 2)
      ctx.fillStyle = t.labelInk
      ctx.fillText(text, texW / 2, texH / 2)
      tex.hasAlpha = true
      tex.update(true)
      mat.opacityTexture = tex
    } else {
      // Ink on OPAQUE white — a tiny gallery label card. No alpha pipeline at
      // all: dark glyphs die in luminance-derived opacity (learned the hard way).
      tex.drawText(
        text,
        null,
        null,
        `bold ${fontPx}px sans-serif`,
        TOKENS.color.ink,
        TOKENS.color.floor,
        true
      )
    }
    mat.emissiveTexture = tex
    mat.disableLighting = true
    mat.backFaceCulling = false

    const plane = MeshBuilder.CreatePlane(name, { width: wPlane, height: hPlane }, this.scene)
    plane.parent = parent
    plane.position = position
    plane.material = mat
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.isPickable = false
    if (t) plane.metadata = { textW }
    return plane
  }

  /** Shared materials (one per body/direction) — placeholders must stay cheap. */
  private material(key: string, hex?: string, color?: Color3, glow = 0.25): StandardMaterial {
    let mat = this.materials.get(key)
    if (!mat) {
      mat = new StandardMaterial(`mat:${key}`, this.scene)
      const c = color ?? Color3.FromHexString(hex ?? '#888888')
      mat.diffuseColor = c
      mat.emissiveColor = c.scale(glow)
      this.materials.set(key, mat)
    }
    return mat
  }
}
