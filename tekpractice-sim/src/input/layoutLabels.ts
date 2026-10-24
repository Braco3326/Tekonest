/**
 * Display labels for physical key codes (help overlay, settings). Bindings stay
 * on KeyboardEvent.code; only the LABEL follows the user's layout. The browser
 * layout map (navigator.keyboard.getLayoutMap, Chromium) wins when available;
 * otherwise a French (France/Belgium) locale implies AZERTY.
 */
export type Layout = 'azerty' | 'qwerty'

const AZERTY_LETTERS: Record<string, string> = { KeyW: 'Z', KeyA: 'Q', KeyQ: 'A', KeyZ: 'W', Semicolon: 'M' }

const SPECIAL: Record<string, string> = {
  Space: 'Espace',
  ShiftLeft: 'Maj',
  ShiftRight: 'Maj',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  Escape: 'Échap',
  Enter: 'Entrée',
  Tab: 'Tab',
  Backspace: 'Retour arrière',
  Delete: 'Suppr',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageUp: 'Page ↑',
  PageDown: 'Page ↓',
}

const CHORD_PREFIX: Record<string, string> = { Ctrl: 'Ctrl', Alt: 'Alt', Meta: 'Méta' }

export function labelFor(code: string, layout: Layout, layoutMap?: ReadonlyMap<string, string>): string {
  // Chord binding ('Alt+KeyH', see bindings.chordFor): label each part.
  const plus = code.lastIndexOf('+')
  if (plus > 0) {
    const mods = code.slice(0, plus).split('+').map((m) => CHORD_PREFIX[m] ?? m)
    return [...mods, labelFor(code.slice(plus + 1), layout, layoutMap)].join('+')
  }
  if (SPECIAL[code]) return SPECIAL[code]
  // Numpad keys keep their physical name ("Numpad 1"): the layout map would say "1",
  // which reads like the Digit1 preset key.
  if (/^Numpad\d$/.test(code)) return `Numpad ${code.slice(6)}`
  const fromMap = layoutMap?.get(code)
  if (fromMap) return fromMap.toUpperCase()
  if (layout === 'azerty' && AZERTY_LETTERS[code]) return AZERTY_LETTERS[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

/** fr-FR, fr-BE, fr-LU, fr-MC… are AZERTY; fr-CA and fr-CH are QWERTY/QWERTZ (labels = code). */
export function detectLayout(locale: string): Layout {
  const l = locale.toLowerCase()
  if (!l.startsWith('fr')) return 'qwerty'
  return l === 'fr' || /^fr-(fr|be|lu|mc)/.test(l) ? 'azerty' : 'qwerty'
}
