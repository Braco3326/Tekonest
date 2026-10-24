/**
 * Camera presets buttons "Vue 1 / 2 / 3" (designer nav, Task 5). DOM only: the
 * pose store is src/camera/presets.ts, the flight is the host's (CameraRig).
 * Click recalls; right-click, a 600 ms long-press or Shift+Enter saves. Copy
 * from docs/copy/designer-nav-essais.md section 2 (preset.*). Phase B will
 * dock this group next to the view cube; for now it sits under the toolbar.
 * Buttons are built once and updated in place (keyboard focus survives).
 */
import type { PresetSlots } from '../camera/presets'

export interface CameraPresetsDeps {
  root: HTMLElement
  /** Current slots of the active room (re-read on every refresh). */
  slots(): PresetSlots
  /** Key label of slot 0..2 in the learner's layout ("1"). */
  keyLabel(slot: number): string
  /** Presets are an orbit feature: false while walking in Explore. */
  available(): boolean
  /** Click or key on a FILLED slot. */
  recall(slot: number): void
  /** Right-click / long-press / Shift+Enter: save the current view (the host toasts the result). */
  save(slot: number): void
  /** Click or key on an EMPTY slot: teach the gesture. */
  empty(slot: number): void
}

export const LONG_PRESS_MS = 600

export class CameraPresets {
  private el: HTMLElement
  private buttons: HTMLButtonElement[] = []
  /** A long-press already saved: swallow the click / contextmenu that follows the same gesture. */
  private suppressUntil = 0
  private saveRow!: HTMLElement

  constructor(private deps: CameraPresetsDeps) {
    this.el = document.createElement('div')
    this.el.id = 'camera-presets'
    this.el.setAttribute('role', 'group')
    this.el.setAttribute('aria-label', 'Vues enregistrées')
    for (let slot = 0; slot < 3; slot++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.slot = String(slot + 1)
      this.wire(b, slot)
      this.el.appendChild(b)
      this.buttons.push(b)
    }
    // Named keyboard/pointer path for saving (every action has a button): a toggle reveals three save buttons.
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'save-toggle'
    toggle.textContent = 'Enregistrer ici'
    toggle.setAttribute('aria-expanded', 'false')
    this.saveRow = document.createElement('div')
    this.saveRow.className = 'save-row'
    this.saveRow.hidden = true
    toggle.addEventListener('click', () => {
      this.saveRow.hidden = !this.saveRow.hidden
      toggle.setAttribute('aria-expanded', String(!this.saveRow.hidden))
    })
    for (let slot = 0; slot < 3; slot++) {
      const s = document.createElement('button')
      s.type = 'button'
      s.dataset.save = String(slot + 1)
      s.textContent = `Vue ${slot + 1}`
      s.setAttribute('aria-label', `Enregistrer ici : Vue ${slot + 1}`)
      s.addEventListener('click', () => {
        this.deps.save(slot)
        this.refresh()
      })
      this.saveRow.appendChild(s)
    }
    this.el.append(toggle, this.saveRow)
    deps.root.appendChild(this.el)
    this.refresh()
  }

  private wire(b: HTMLButtonElement, slot: number): void {
    let timer: number | undefined
    const clear = (): void => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
    }
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      clear()
      timer = window.setTimeout(() => {
        timer = undefined
        this.suppressUntil = performance.now() + 700
        this.deps.save(slot)
        this.refresh()
      }, LONG_PRESS_MS)
    })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, clear)
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      // A touch long-press fires contextmenu after our own timer: save once.
      if (performance.now() < this.suppressUntil) return
      this.suppressUntil = performance.now() + 300
      this.deps.save(slot)
      this.refresh()
    })
    b.addEventListener('click', () => {
      if (performance.now() < this.suppressUntil) return
      this.press(slot)
    })
    // Keyboard path for "save" (every action has a named control; right-click is not the only way).
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        this.deps.save(slot)
        this.refresh()
      }
    })
  }

  /** Recall slot (0..2): a filled slot flies, an empty one teaches the gesture. */
  press(slot: number): void {
    if (!this.deps.available()) return
    if (this.deps.slots()[slot]) this.deps.recall(slot)
    else this.deps.empty(slot)
  }

  /** Re-render labels, tooltips and visibility (view switch, key remap, room change, save). */
  refresh(): void {
    this.el.hidden = !this.deps.available()
    const slots = this.deps.slots()
    this.buttons.forEach((b, i) => {
      const n = i + 1
      const key = this.deps.keyLabel(i)
      const filled = slots[i] !== null
      const html = `Vue ${n} <kbd>${key.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</kbd>`
      if (b.innerHTML !== html) b.innerHTML = html
      b.classList.toggle('is-empty', !filled)
      b.title = filled
        ? `Vue ${n} (touche ${key}). Clic droit ou appui long pour la remplacer.`
        : `Vue ${n} vide. Placez la caméra, puis clic droit ou appui long pour l'enregistrer.`
      b.setAttribute('aria-label', filled ? `Vue ${n} : aller à cette vue` : `Vue ${n} : vide, appui long pour enregistrer`)
    })
  }
}
