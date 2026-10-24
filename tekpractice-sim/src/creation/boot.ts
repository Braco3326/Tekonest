import { COPY } from './copy'

/** Stub shell (Task 1): hides the legacy canvas and shows the place-picker placeholder. */
export async function bootCreation(): Promise<void> {
  const canvas = document.getElementById('renderCanvas')
  if (canvas) canvas.style.display = 'none'
  const main = document.createElement('main')
  main.dataset.testid = 'place-picker'
  main.className = 'cr-placeholder'
  // Minimal Nuit / Papier look until the shell stylesheet lands (square corners).
  main.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#131114;color:#F3EDE3;border-radius:0;'
  const h1 = document.createElement('h1')
  h1.textContent = COPY.picker!.title!
  main.appendChild(h1)
  document.body.appendChild(main)
}
