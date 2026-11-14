/**
 * G14e (review S7): ONE checker for the keyboard-only route of tests/e2e/onboarding-keyboard.spec.ts (plan T7.1c, spec 4.3). The vitest keyboardOnboardingSpec.test.ts runs it on the real route AND on
 * crafted lines, so the proof that it bites is a proof about this function, not about a regex written beside it.
 *
 * What counts as a cheat: any pointer call; any shortcut around the keys (a programmatic focus or blur, a field filled, checked or chosen directly, text inserted without key events
 * (`keyboard.insertText`), a value or a checked state written from the page, an event dispatched from the page); any action through the debug hook (`dispatch`, a place chosen, a control set,
 * a camera moved, undo / redo, a patch click); the kit's dispatching or mouse helpers (`act`, `connect`, `spawn`, `testSignal`).
 */
export const CHEATS: readonly { name: string; re: RegExp }[] = [
  { name: 'the mouse', re: /\.mouse\b/ },
  { name: 'a pointer call', re: /\.(click|dblclick|tap|hover|dragTo|dragAndDrop)\(/ },
  { name: 'a click of any kind', re: /\bclick\(/i },
  { name: 'a programmatic focus or blur', re: /\.(focus|blur)\(/ },
  { name: 'a field filled, checked or chosen directly', re: /\.(fill|check|uncheck|setChecked|selectOption|selectText|setInputFiles|press\w*Sequentially)\(/ },
  { name: 'text inserted without key events', re: /\binsertText\b/ },
  { name: 'a value written from the page', re: /\.(value|checked|selectedIndex|textContent|innerText|innerHTML)\s*=(?!=)/ },
  { name: 'an event dispatched from the page', re: /\bdispatchEvent\b|new\s+(Keyboard|Mouse|Pointer|Input|Focus)Event\b/ },
  { name: 'an intent dispatched through the hook', re: /\.dispatch\(/ },
  { name: 'an action through the hook', re: /\b(choosePlace|requestPlace|setControlValue|frameDevice|setCameraRadius|turnCamera|patchClick)\b|\.setValue\(|\.(undo|redo)\(/ },
  { name: 'a dispatching or mouse helper of the kit', re: /\b(act|connect|spawn|testSignal)\(/ },
]

/** The cheats found in a route text, one line each (`name: the offending line`). Empty = keyboard only. */
export function cheats(body: string): string[] {
  const out: string[] = []
  for (const line of body.split('\n')) {
    const code = line.replace(/\/\/.*$/, '') // a comment is not a call
    for (const c of CHEATS) if (c.re.test(code)) out.push(`${c.name}: ${line.trim().slice(0, 120)}`)
  }
  return out
}
