/**
 * Temporary place picker (Task 6, replaced by the real picker in Task 12):
 * a heading and three hard-coded place buttons, shown inside the 3D viewport
 * until a place is chosen, then hidden (the « Lieu » menu changes the place
 * from then on). Choosing calls `onPick` (the same path as the `requestPlace`
 * debug hook). Styles: `.cr-picker` in creation.css.
 */
import { COPY } from '../copy'

export interface StubPlace {
  key: string
  label: string
}

export function mountPlacePickerStub(places: StubPlace[], onPick: (key: string) => void, parent: HTMLElement): { hide(): void } {
  const doc = parent.ownerDocument
  const section = doc.createElement('section')
  section.dataset.testid = 'place-picker'
  section.className = 'cr-picker'
  section.setAttribute('aria-labelledby', 'cr-picker-title')
  const h1 = doc.createElement('h1')
  h1.id = 'cr-picker-title'
  h1.textContent = COPY.picker!.title!
  const nav = doc.createElement('nav')
  nav.setAttribute('aria-label', COPY.picker!.title!)
  for (const p of places) {
    const b = doc.createElement('button')
    b.type = 'button'
    b.textContent = p.label
    b.dataset.place = p.key
    b.addEventListener('click', () => onPick(p.key))
    nav.appendChild(b)
  }
  section.append(h1, nav)
  parent.appendChild(section)
  return {
    hide() {
      section.hidden = true
    },
  }
}
