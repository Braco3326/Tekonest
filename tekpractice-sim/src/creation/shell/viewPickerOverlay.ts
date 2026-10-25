/**
 * « Choisir une vue » (Task 18, C11, CA-05): the `V` picker. The keyboard and
 * screen-reader way to the cube's 26 views (its edge / corner targets are small).
 * A small modal grid on the shared modal (focus trap, Esc, focus return):
 * - 5 rows: Dessus (one cell), 8 azimuths at ¾ above, 8 at the horizon, 8 at ¾ below, Dessous;
 *   columns clockwise from Face, so → turns toward « Droite » (src/camera/viewPicker.ts);
 * - each cell a button named by `zoneLabel`; one tab stop (roving tabindex), arrows move with
 *   `pickerMove`; leaving a pole comes back to the azimuth you came from (prevAz contract);
 * - Entrée / Espace / a click chooses (resolves the zone), Échap / « Annuler » resolve null.
 * The caller flies the camera and puts focus back on the canvas.
 */
import { nearestZone, OCTANTS, zoneId, zoneLabel, type ZoneSigns } from '../../camera/cubeZones'
import { PICKER_CELLS, pickerMove, type PickerCell } from '../../camera/viewPicker'
import { COPY } from '../copy'
import { modalButton, modalRow, openModal } from './modal'

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
type Arrow = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/** The picker cell of the view the camera is closest to, and the azimuth to leave a pole by. */
export function startCell(alpha: number, beta: number): { cell: PickerCell; az: number } {
  const z = nearestZone(alpha, beta)
  const id = zoneId(z)
  const cell = PICKER_CELLS.find((c) => zoneId(c.zone) === id)!
  // A pole has no azimuth of its own: the camera's heading, as the horizon would see it.
  const h = nearestZone(alpha, Math.PI / 2)
  const az = OCTANTS.findIndex(([x, z2]) => x === h.x && z2 === h.z)
  return { cell, az: Math.abs(cell.el) === 2 ? Math.max(0, az) : cell.az }
}

export function openViewPicker(camera: { alpha: number; beta: number }): Promise<ZoneSigns | null> {
  const V = COPY.views!
  const start = startCell(camera.alpha, camera.beta)
  return openModal<ZoneSigns | null>({
    id: 'view-picker',
    title: V.pickerTitle!,
    body: `${V.current!.replace('{view}', zoneLabel(start.cell.zone))} ${V.pickerHelp}`,
    cancel: null,
    build(box, done) {
      box.classList.add('cr-views')
      const grid = document.createElement('div')
      grid.className = 'cr-views-grid'
      grid.setAttribute('role', 'grid')
      grid.setAttribute('aria-labelledby', 'view-picker-title')
      const buttons = new Map<PickerCell, HTMLButtonElement>()
      let active = start.cell
      /** The last non-pole azimuth (pickerMove's prevAz). */
      let lastAz = start.az
      for (const el of [2, 1, 0, -1, -2]) {
        const row = document.createElement('div')
        row.className = 'cr-views-row'
        row.setAttribute('role', 'row')
        row.dataset.el = String(el)
        for (const cell of PICKER_CELLS.filter((c) => c.el === el)) {
          const gc = document.createElement('div')
          gc.setAttribute('role', 'gridcell')
          if (Math.abs(el) === 2) gc.setAttribute('aria-colspan', '8')
          gc.className = 'cr-views-cell'
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'cr-views-btn'
          b.dataset.zone = zoneId(cell.zone)
          b.textContent = zoneLabel(cell.zone)
          b.tabIndex = cell === active ? 0 : -1
          if (cell === start.cell) b.setAttribute('aria-current', 'true')
          b.addEventListener('click', () => done(cell.zone))
          b.addEventListener('focus', () => moveTo(cell, false))
          gc.appendChild(b)
          row.appendChild(gc)
          buttons.set(cell, b)
        }
        grid.appendChild(row)
      }
      const moveTo = (cell: PickerCell, focus: boolean): void => {
        if (cell !== active) {
          buttons.get(active)!.tabIndex = -1
          active = cell
          buttons.get(cell)!.tabIndex = 0
        }
        if (Math.abs(cell.el) !== 2) lastAz = cell.az
        if (focus) buttons.get(cell)!.focus()
      }
      grid.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!ARROWS.has(e.key) || e.ctrlKey || e.altKey || e.metaKey) return
        e.preventDefault() // the page never scrolls
        moveTo(pickerMove(active, e.key as Arrow, lastAz), true)
      })
      const cancel = modalButton(V.cancel!, false)
      cancel.addEventListener('click', () => done(null))
      box.append(grid, modalRow(cancel))
      return { first: buttons.get(active)!, edges: () => [buttons.get(active)!, cancel] }
    },
  })
}
