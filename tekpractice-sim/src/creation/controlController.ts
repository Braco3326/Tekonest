/**
 * creation/controlController: the pointer side of the hands-on controls. On the SELECTED device, a press on a fader cap, knob, key or
 * switch operates it instead of orbiting the camera or moving the device:
 *   fader   drag along the slot (the pointer ray is projected on the cap's own line, so the cap follows the pointer exactly); Shift = fine;
 *   knob    drag up / right to turn up (Shift = fine);
 *   button  a click (latching key), or held (momentary); keys of one radio group (ON / OFF) exclude each other;
 *   switch  a click steps to the next position.
 * A double-click on a fader or knob puts it back to its default. While held, the control's value is shown next to the pointer.
 *
 * The press is taken in the CAPTURE phase on `window`, before any canvas listener (the camera, the placement drag, the selection click),
 * and stopped, so none of them ever sees it; the matching move / release are taken the same way until the release. A press anywhere else
 * is left alone, untouched. The controls of an unselected device are not live (its first click selects it, as everywhere).
 */
import type { ArcRotateCamera, Scene, AbstractMesh } from '@babylonjs/core'
import { Vector3 } from '@babylonjs/core'
import type { DeviceInstance } from '../scene/DeviceSpawner'
import type { DisposableBag } from '../util/disposable'
import { controlHit } from '../controls/controlHit'
import { valueText } from '../controls/tapers'
import type { ControlDef } from '../controls/controlTypes'

export interface ControlHost {
  scene: Scene
  camera: ArcRotateCamera
  canvas: HTMLElement
  instance(id: string): DeviceInstance | undefined
  /** The selected device: only its controls are live. */
  selected(): string | null
  /** Ask for a frame. */
  invalidate(): void
  /** An operation is finished (a key pressed, a drag released, a reset): the value to carry to the simulation, once, not on every pointer move. */
  committed?(instanceId: string, def: ControlDef, value: number): void
}

/** Pointer travel (CSS px) for a knob to sweep its whole range; Shift divides the speed by FINE. */
const KNOB_PX = 220
const FINE = 5
const DOUBLE_MS = 350

interface Drag {
  instanceId: string
  def: ControlDef
  pointerId: number
  lastX: number
  lastY: number
  moved: boolean
  /** fader: the last projected value along the slot. */
  lastSlide: number
  /** Value at the press. */
  start: number
}

export class ControlController {
  private drag: Drag | null = null
  private hover: { instanceId: string; controlId: string } | null = null
  private lastClick: { id: string; t: number } | null = null
  private hud: HTMLElement | null = null
  private hudTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(
    private readonly host: ControlHost,
    bag: DisposableBag
  ) {
    const win = typeof window !== 'undefined' ? window : null
    if (!win) return
    bag.listen(win, 'pointerdown', (e: PointerEvent) => this.onDown(e), { capture: true })
    bag.listen(win, 'pointermove', (e: PointerEvent) => this.onMove(e), { capture: true })
    bag.listen(win, 'pointerup', (e: PointerEvent) => this.onUp(e), { capture: true })
    bag.listen(win, 'pointercancel', (e: PointerEvent) => this.onUp(e), { capture: true })
    bag.add(() => {
      this.disposed = true
      this.endDrag()
      this.setHover(null)
      this.hud?.remove()
      if (this.hudTimer) clearTimeout(this.hudTimer)
    })
  }

  // ── picking ───────────────────────────────────────────────────────────────────────────────────────────────

  /** The live control under a canvas point (the selected device's, not hidden behind a nearer body), or null. */
  controlAt(x: number, y: number): { instance: DeviceInstance; def: ControlDef } | null {
    const sel = this.host.selected()
    if (!sel) return null
    const inst = this.host.instance(sel)
    const bank = inst?.controls?.bank
    if (!inst || !bank) return null
    const own = (m: AbstractMesh): boolean => m.isEnabled() && controlHit(m)?.instanceId === sel
    const pad = this.host.scene.pick(x, y, own)
    if (!pad?.hit || !pad.pickedMesh) return null
    const body = this.host.scene.pick(x, y, (m) => m.metadata?.isDeviceBody === true && m.isEnabled() && m.isVisible)
    // A device in front of the control (another body, or this one seen from the wrong side) takes the click.
    if (body?.hit && body.distance < pad.distance - 0.03) return null
    const hit = controlHit(pad.pickedMesh)
    const def = hit ? bank.def(hit.controlId) : undefined
    return def ? { instance: inst, def } : null
  }

  private point(e: PointerEvent): { x: number; y: number } {
    const r = this.host.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // ── events ────────────────────────────────────────────────────────────────────────────────────────────────

  private onDown(e: PointerEvent): void {
    if (this.disposed || this.drag) return
    if (e.target !== this.host.canvas || e.button !== 0 || !e.isPrimary) return
    if (e.ctrlKey || e.metaKey || e.altKey) return // camera gestures stay the camera's
    const { x, y } = this.point(e)
    const found = this.controlAt(x, y)
    if (!found) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const { instance, def } = found
    const bank = instance.controls!.bank
    const rig = instance.controls!.rig
    const t = e.timeStamp
    const id = `${instance.instanceId}/${def.id}`
    const double = this.lastClick && this.lastClick.id === id && t - this.lastClick.t <= DOUBLE_MS
    this.lastClick = { id, t }
    const drag: Drag = { instanceId: instance.instanceId, def, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY, moved: false, lastSlide: 0, start: bank.get(def.id) }
    switch (def.kind) {
      case 'fader': {
        if (double) {
          bank.reset(def.id)
          this.showValue(def, bank.get(def.id), e)
          this.host.committed?.(instance.instanceId, def, bank.get(def.id))
          this.host.invalidate()
          return
        }
        const slide = this.slideValue(instance, def, x, y)
        drag.lastSlide = slide ?? bank.get(def.id)
        break
      }
      case 'knob':
        if (double) {
          bank.reset(def.id)
          this.showValue(def, bank.get(def.id), e)
          this.host.committed?.(instance.instanceId, def, bank.get(def.id))
          this.host.invalidate()
          return
        }
        break
      case 'button': {
        const now = bank.get(def.id)
        if (def.group && now === 1) break // radio: the pressed key of its group stays pressed
        bank.set(def.id, def.latch === false ? 1 : now ? 0 : 1, 'user')
        this.host.committed?.(instance.instanceId, def, bank.get(def.id))
        break
      }
      case 'switch': {
        const n = def.positions ?? 2
        bank.set(def.id, (Math.round(bank.get(def.id)) + 1) % n, 'user')
        this.host.committed?.(instance.instanceId, def, bank.get(def.id))
        break
      }
      default:
        return // led / meter: nothing to operate (the press went to a pad that does not exist for them)
    }
    rig.setHover(def.id)
    this.drag = drag
    this.showValue(def, bank.get(def.id), e)
    this.host.invalidate()
  }

  private onMove(e: PointerEvent): void {
    if (this.disposed) return
    const d = this.drag
    if (!d) {
      if (e.target === this.host.canvas && e.buttons === 0) this.updateHover(e)
      return
    }
    if (e.pointerId !== d.pointerId) return
    e.stopImmediatePropagation()
    const inst = this.host.instance(d.instanceId)
    const bank = inst?.controls?.bank
    if (!inst || !bank) return this.endDrag()
    const fine = e.shiftKey ? 1 / FINE : 1
    if (Math.hypot(e.clientX - d.lastX, e.clientY - d.lastY) > 0) d.moved = true
    if (d.def.kind === 'fader') {
      const { x, y } = this.point(e)
      const slide = this.slideValue(inst, d.def, x, y)
      if (slide !== null) {
        bank.set(d.def.id, bank.get(d.def.id) + (slide - d.lastSlide) * fine, 'user')
        d.lastSlide = slide
      }
    } else if (d.def.kind === 'knob') {
      const dv = ((d.lastY - e.clientY) + (e.clientX - d.lastX) * 0.5) / KNOB_PX
      bank.set(d.def.id, bank.get(d.def.id) + dv * fine, 'user')
    }
    d.lastX = e.clientX
    d.lastY = e.clientY
    this.showValue(d.def, bank.get(d.def.id), e)
    this.host.invalidate()
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag
    if (!d || e.pointerId !== d.pointerId) return
    e.stopImmediatePropagation()
    const bank = this.host.instance(d.instanceId)?.controls?.bank
    if (bank && d.def.kind === 'button' && d.def.latch === false) bank.set(d.def.id, 0, 'user') // momentary: released
    if (bank && d.moved && (d.def.kind === 'fader' || d.def.kind === 'knob')) this.host.committed?.(d.instanceId, d.def, bank.get(d.def.id))
    this.endDrag()
    this.host.invalidate()
  }

  private endDrag(): void {
    if (this.drag) this.host.instance(this.drag.instanceId)?.controls?.rig.setHover(null)
    this.drag = null
    this.scheduleHudHide()
  }

  // ── fader geometry ────────────────────────────────────────────────────────────────────────────────────────

  /** Where the pointer is along a fader's slot, as a 0..1 value (the ray meets the plane of the slot); null when the ray runs parallel to it. */
  private slideValue(inst: DeviceInstance, def: ControlDef, x: number, y: number): number | null {
    const g = inst.controls?.rig.slideOf(def.id)
    if (!g) return null
    const ray = this.host.scene.createPickingRay(x, y, null, this.host.camera)
    const denom = Vector3.Dot(ray.direction, g.normal)
    if (Math.abs(denom) < 1e-4) return null
    const t = Vector3.Dot(g.origin.subtract(ray.origin), g.normal) / denom
    if (t < 0) return null
    const hit = ray.origin.add(ray.direction.scale(t))
    return Vector3.Dot(hit.subtract(g.origin), g.dir) / g.length
  }

  // ── hover ─────────────────────────────────────────────────────────────────────────────────────────────────

  private updateHover(e: PointerEvent): void {
    const { x, y } = this.point(e)
    const found = this.controlAt(x, y)
    this.setHover(found ? { instanceId: found.instance.instanceId, controlId: found.def.id } : null)
    this.host.canvas.style.cursor = found ? (found.def.kind === 'fader' ? 'ns-resize' : found.def.kind === 'knob' ? 'grab' : 'pointer') : ''
  }

  private setHover(next: { instanceId: string; controlId: string } | null): void {
    const prev = this.hover
    if (prev && next && prev.instanceId === next.instanceId && prev.controlId === next.controlId) return
    if (prev) this.host.instance(prev.instanceId)?.controls?.rig.setHover(null)
    this.hover = next
    if (next) this.host.instance(next.instanceId)?.controls?.rig.setHover(next.controlId)
    if (!next) this.host.canvas.style.cursor = ''
    this.host.invalidate()
  }

  // ── value readout ─────────────────────────────────────────────────────────────────────────────────────────

  private showValue(def: ControlDef, value: number, e: PointerEvent): void {
    if (typeof document === 'undefined') return
    if (!this.hud) {
      const el = document.createElement('div')
      el.setAttribute('role', 'status')
      el.setAttribute('aria-live', 'polite')
      el.style.cssText =
        'position:fixed;z-index:2000;pointer-events:none;padding:3px 8px;border-radius:5px;font:600 12px/1.3 system-ui,sans-serif;color:#fff;background:rgba(14,16,20,.92);box-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap;transition:opacity .15s'
      document.body.appendChild(el)
      this.hud = el
    }
    if (this.hudTimer) clearTimeout(this.hudTimer)
    this.hud.textContent = `${def.label ? `${def.label} · ` : ''}${valueText(def, value)}`
    this.hud.style.left = `${e.clientX + 16}px`
    this.hud.style.top = `${e.clientY - 30}px`
    this.hud.style.opacity = '1'
  }

  private scheduleHudHide(): void {
    if (this.hudTimer) clearTimeout(this.hudTimer)
    this.hudTimer = setTimeout(() => {
      if (this.hud) this.hud.style.opacity = '0'
    }, 700)
  }
}
