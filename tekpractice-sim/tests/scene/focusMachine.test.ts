/**
 * focusMachine (ADR-0008) — every spec §1-2 transition, pure & headless.
 * The machine emits commands; it never validates nor mutates anything.
 */
import { describe, expect, it } from 'vitest'
import {
  initialState,
  reduce,
  repickup,
  type FocusEvent,
  type FocusState,
} from '../../src/scene/focusMachine'

const P1 = { instance: 'sm58-1', port: 'out-xlr' }
const P2 = { instance: 'rio-1', port: 'in-mic-1' }

const run = (state: FocusState, ...events: FocusEvent[]) => {
  let s = state
  const all: string[] = []
  for (const e of events) {
    const t = reduce(s, e)
    s = t.state
    all.push(...t.commands.map((c) => c.kind))
  }
  return { state: s, kinds: all }
}

describe('Ensemble ⇄ Focus (spec §1)', () => {
  it('double-click flies to the device and focuses it', () => {
    const t = reduce(initialState(), { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'ql1-1' })
    expect(t.state).toMatchObject({ mode: 'focus', focused: 'ql1-1', selected: 'ql1-1' })
    expect(t.commands).toEqual([{ kind: 'flyToDevice', instanceId: 'ql1-1' }])
  })

  // N1 (night brief 2026-10-24) overrides ADR-0008's "single click = select":
  // a single click now focuses, exactly like a double-click (pivot = the device).
  it('single click focuses and flies to the device (N1)', () => {
    const t = reduce(initialState(), { type: 'DEVICE_CLICK', instanceId: 'ql1-1' })
    expect(t.state).toMatchObject({ mode: 'focus', focused: 'ql1-1', selected: 'ql1-1' })
    expect(t.commands).toEqual([{ kind: 'flyToDevice', instanceId: 'ql1-1' }])
  })

  it('a single click on the device ALREADY focused does not re-fly (a missed port click keeps your orbit)', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'DEVICE_CLICK', instanceId: 'ql1-1' },
      { type: 'DEVICE_CLICK', instanceId: 'ql1-1' },
    )
    expect(state).toMatchObject({ mode: 'focus', focused: 'ql1-1' })
    expect(kinds).toEqual(['flyToDevice'])
  })

  it('a click on another device while holding a cable refocuses and KEEPS the cable (N1)', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'DEVICE_CLICK', instanceId: 'sm58-1' },
      { type: 'PORT_CLICK', ref: P1 },
      { type: 'DEVICE_CLICK', instanceId: 'rio-1' },
    )
    expect(state).toMatchObject({ mode: 'focus', focused: 'rio-1', held: P1 })
    expect(kinds).toEqual(['flyToDevice', 'pickup', 'flyToDevice'])
  })

  it('right-click and empty-click fly back to Ensemble', () => {
    for (const type of ['RIGHT_CLICK', 'EMPTY_CLICK'] as const) {
      const { state, kinds } = run(
        initialState(),
        { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'ql1-1' },
        { type },
      )
      expect(state.mode).toBe('ensemble')
      expect(state.focused).toBeNull()
      expect(kinds).toContain('flyToEnsemble')
    }
  })

  it('device→device refocus flies directly (no forced return)', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'ql1-1' },
      { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'rio-1' },
    )
    expect(state).toMatchObject({ mode: 'focus', focused: 'rio-1' })
    expect(kinds.filter((k) => k === 'flyToDevice')).toHaveLength(2)
  })
})

describe('floor re-pivot (Task 4)', () => {
  const point: [number, number, number] = [1.5, 0, -2]

  it('in Ensemble: emits repivot only — no flight home, mode unchanged', () => {
    const t = reduce(initialState(), { type: 'FLOOR_DOUBLE_CLICK', point })
    expect(t.commands).toEqual([{ kind: 'repivot', point }])
    expect(t.state.mode).toBe('ensemble')
  })

  it('in Focus: leaves focus (ensemble, focused null) but does NOT fly back to Ensemble', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'ql1-1' },
      { type: 'FLOOR_DOUBLE_CLICK', point },
    )
    expect(state).toMatchObject({ mode: 'ensemble', focused: null })
    expect(kinds).toEqual(['flyToDevice', 'repivot'])
    expect(kinds).not.toContain('flyToEnsemble')
  })

  it('keeps a held cable', () => {
    const { state } = run(initialState(), { type: 'PORT_CLICK', ref: P1 }, { type: 'FLOOR_DOUBLE_CLICK', point })
    expect(state.held).toEqual(P1)
  })
})

describe('HOME (Alt+H / « Vue d’ensemble », Task 4)', () => {
  it('from Focus: flies to Ensemble, cable kept (like right-click)', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'sm58-1' },
      { type: 'PORT_CLICK', ref: P1 },
      { type: 'HOME' },
    )
    expect(state).toMatchObject({ mode: 'ensemble', focused: null, held: P1 })
    expect(kinds[kinds.length - 1]).toBe('flyToEnsemble')
  })

  it('from Ensemble: also flies home (after a pan / re-pivot the view comes back)', () => {
    const t = reduce(initialState(), { type: 'HOME' })
    expect(t.commands).toEqual([{ kind: 'flyToEnsemble' }])
    expect(t.state.mode).toBe('ensemble')
  })
})

describe('held cable (spec §1 steps 3-5)', () => {
  it('port click picks the cable up; it SURVIVES the return to Ensemble', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'sm58-1' },
      { type: 'PORT_CLICK', ref: P1 },
      { type: 'RIGHT_CLICK' }, // back to Ensemble — cable still in hand
    )
    expect(state.mode).toBe('ensemble')
    expect(state.held).toEqual(P1)
    expect(kinds).toContain('pickup')
    expect(kinds).not.toContain('dropHeld')
  })

  it('second port click emits connect and releases the hand', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'PORT_CLICK', ref: P1 },
      { type: 'PORT_CLICK', ref: P2 },
    )
    expect(state.held).toBeNull()
    expect(kinds).toEqual(['pickup', 'connect'])
  })

  it('clicking the held end again cancels (spec §2 table)', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'PORT_CLICK', ref: P1 },
      { type: 'PORT_CLICK', ref: P1 },
    )
    expect(state.held).toBeNull()
    expect(kinds).toEqual(['pickup', 'dropHeld'])
  })

  it('a cable can be started from either end (unordered chain)', () => {
    const t = run(initialState(), { type: 'PORT_CLICK', ref: P2 }, { type: 'PORT_CLICK', ref: P1 })
    expect(t.kinds).toContain('connect')
  })

  it('repickup re-arms the hand after a rejected connect', () => {
    const t = repickup(initialState(), P1)
    expect(t.state.held).toEqual(P1)
    expect(t.commands).toEqual([{ kind: 'pickup', from: P1 }])
  })
})

describe('ESC policy (ADR-0008: undo the most recent commitment)', () => {
  it('with a held cable: first Esc cancels the cable, second leaves focus', () => {
    const afterOne = run(
      initialState(),
      { type: 'DEVICE_DOUBLE_CLICK', instanceId: 'sm58-1' },
      { type: 'PORT_CLICK', ref: P1 },
      { type: 'ESC' },
    )
    expect(afterOne.state.held).toBeNull()
    expect(afterOne.state.mode).toBe('focus') // still framing the device

    const afterTwo = run(afterOne.state, { type: 'ESC' })
    expect(afterTwo.state.mode).toBe('ensemble')
    expect(afterTwo.kinds).toContain('flyToEnsemble')
  })

  it('Esc in Ensemble with empty hands is a no-op', () => {
    const t = reduce(initialState(), { type: 'ESC' })
    expect(t.commands).toEqual([])
    expect(t.state.mode).toBe('ensemble')
  })
})

describe('keyboard (spec §2: Tab cycles, Enter focuses)', () => {
  const ids = ['sm58-1', 'rio-1', 'ql1-1']

  it('Tab cycles through devices and wraps', () => {
    let s = initialState()
    const seen: (string | null)[] = []
    for (let i = 0; i < 4; i++) {
      s = reduce(s, { type: 'TAB', instanceIds: ids }).state
      seen.push(s.selected)
    }
    expect(seen).toEqual(['sm58-1', 'rio-1', 'ql1-1', 'sm58-1'])
  })

  it('Enter focuses the selected device', () => {
    const { state, kinds } = run(
      initialState(),
      { type: 'TAB', instanceIds: ids },
      { type: 'ENTER' },
    )
    expect(state).toMatchObject({ mode: 'focus', focused: 'sm58-1' })
    expect(kinds).toContain('flyToDevice')
  })

  it('Enter with nothing selected is a no-op; Tab on an empty stage too', () => {
    expect(reduce(initialState(), { type: 'ENTER' }).commands).toEqual([])
    expect(reduce(initialState(), { type: 'TAB', instanceIds: [] }).commands).toEqual([])
  })
})

describe('discipline: the machine never mutates anything but its own state', () => {
  it('emits only camera/cable commands — connect is a COMMAND, never applied here', () => {
    const t = run(initialState(), { type: 'PORT_CLICK', ref: P1 }, { type: 'PORT_CLICK', ref: P2 })
    // the machine's entire output surface is state + command kinds
    expect(
      t.kinds.every((k) => ['flyToDevice', 'flyToEnsemble', 'repivot', 'pickup', 'dropHeld', 'connect'].includes(k)),
    ).toBe(true)
  })
})
