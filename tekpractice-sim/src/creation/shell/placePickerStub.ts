/**
 * Temporary place picker (Task 6, replaced by the real picker in Task 12):
 * a heading and three hard-coded place buttons. Full screen until a place is
 * chosen, then a thin bottom bar so the scene shows (the top-left corner
 * belongs to the site link, later the view cube). Choosing calls `onPick` (the
 * same path as the `requestPlace` debug hook).
 */
import { COPY } from '../copy'

export interface StubPlace {
  key: string
  label: string
}

export function mountPlacePickerStub(places: StubPlace[], onPick: (key: string) => void): { compact(): void } {
  const main = document.createElement('main')
  main.dataset.testid = 'place-picker'
  main.className = 'cr-placeholder'
  const full =
    'position:fixed;inset:0;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;' +
    'background:#131114;color:#F3EDE3;border-radius:0;font-family:"IBM Plex Sans",system-ui,sans-serif;z-index:10;'
  main.style.cssText = full
  const h1 = document.createElement('h1')
  h1.textContent = COPY.picker!.title!
  const nav = document.createElement('nav')
  nav.setAttribute('aria-label', COPY.picker!.title!)
  nav.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;'
  for (const p of places) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = p.label
    b.dataset.place = p.key
    b.style.cssText = 'border-radius:0;padding:8px 14px;font:inherit;cursor:pointer;background:transparent;color:#F3EDE3;border:1px solid #DD9349;'
    b.addEventListener('click', () => onPick(p.key))
    nav.appendChild(b)
  }
  main.append(h1, nav)
  document.body.appendChild(main)
  return {
    compact() {
      main.style.cssText =
        'position:fixed;bottom:0;left:0;right:0;display:flex;gap:16px;align-items:center;padding:6px 12px;' +
        'background:#131114;color:#F3EDE3;border-radius:0;font-family:"IBM Plex Sans",system-ui,sans-serif;z-index:10;'
      h1.style.cssText = 'font-size:16px;margin:0;'
    },
  }
}
