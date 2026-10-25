import { describe, expect, it } from 'vitest'
import { zoneId } from '../../src/camera/cubeZones'
import { PICKER_CELLS, pickerMove, type PickerCell } from '../../src/camera/viewPicker'

const cell = (az: number, el: PickerCell['el']): PickerCell => {
  const c = PICKER_CELLS.find((p) => p.az === az && p.el === el)
  if (!c) throw new Error(`no cell ${az}/${el}`)
  return c
}

describe('view picker', () => {
  it('26 cells, one per zone', () => {
    expect(PICKER_CELLS).toHaveLength(26)
    expect(new Set(PICKER_CELLS.map((c) => zoneId(c.zone))).size).toBe(26)
  })
  it('default face is az 0, el 0', () => {
    expect(zoneId(cell(0, 0).zone)).toBe('face')
  })
  it('ArrowLeft / ArrowRight wrap the 8 azimuths', () => {
    expect(pickerMove(cell(0, 0), 'ArrowLeft').az).toBe(7)
    expect(pickerMove(cell(7, 0), 'ArrowRight').az).toBe(0)
    let c = cell(0, 1)
    for (let i = 0; i < 8; i++) c = pickerMove(c, 'ArrowRight')
    expect(c).toBe(cell(0, 1))
    expect(zoneId(pickerMove(cell(0, 0), 'ArrowRight').zone)).toBe('face-droite')
  })
  it('pole memory: the opposite arrow returns to el 1 at prevAz (default az 0)', () => {
    const pole = pickerMove(cell(3, 1), 'ArrowUp')
    expect(pole.el).toBe(2)
    expect(pickerMove(pole, 'ArrowDown', 3)).toBe(cell(3, 1))
    expect(pickerMove(pole, 'ArrowDown')).toBe(cell(0, 1))
    const south = pickerMove(cell(5, -1), 'ArrowDown')
    expect(south.el).toBe(-2)
    expect(pickerMove(south, 'ArrowUp', 5)).toBe(cell(5, -1))
  })
  it('ArrowUp from el 1 goes to the pole, ArrowDown returns to el 1 at az 0 when no prevAz is given', () => {
    const pole = pickerMove(cell(0, 1), 'ArrowUp')
    expect(pole.el).toBe(2)
    expect(zoneId(pole.zone)).toBe('dessus')
    expect(pickerMove(pole, 'ArrowDown')).toBe(cell(0, 1))
    expect(zoneId(pickerMove(pole, 'ArrowDown').zone)).toBe('dessus-face')
  })
  it('vertical moves walk el 0 <-> ±1 <-> ±2 and stop at the ends', () => {
    expect(pickerMove(cell(2, 0), 'ArrowUp')).toBe(cell(2, 1))
    expect(pickerMove(cell(2, 0), 'ArrowDown')).toBe(cell(2, -1))
    expect(pickerMove(cell(2, -1), 'ArrowDown').el).toBe(-2)
    expect(pickerMove(cell(0, 2), 'ArrowUp')).toBe(cell(0, 2))
    expect(pickerMove(cell(0, -2), 'ArrowDown')).toBe(cell(0, -2))
  })
  it('left / right on a pole stay on the pole', () => {
    expect(pickerMove(cell(0, 2), 'ArrowLeft')).toBe(cell(0, 2))
    expect(pickerMove(cell(0, -2), 'ArrowRight')).toBe(cell(0, -2))
  })
})
