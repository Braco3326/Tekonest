/**
 * controls/screenApp: what a console's screen runs. The rig puts a canvas texture on the screen's rectangle and hands this interface
 * the 2D context (draw) and the touches that land on it (pointer, in canvas pixels). An app reads and writes the SAME ControlBank as the
 * 3D faders and keys, so a strip dragged on the glass moves the real fader cap and the other way round. The first app is a mixer
 * overview; the console software of a later phase (scenes, EQ pages, routing) is more apps behind the same two calls.
 */
import type { ControlBank } from './controlBank'
import type { ControlDef } from './controlTypes'
import { barLit } from './meters'
import { controlDb, valueText } from './tapers'

export interface ScreenContext {
  bank: ControlBank
  /** Level of a meter bus in dBFS at a time (the demo signal until real buses feed it). */
  levels: (bus: string, tSec: number) => number
  nowMs: number
}

export type TouchKind = 'down' | 'move' | 'up'

export interface ScreenApp {
  /** Redraws every frame (live meters) rather than only when a value changed. */
  readonly animated: boolean
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, c: ScreenContext): void
  /**
   * A touch at canvas pixel (x, y). Returns whether the app took it, and the id of a control it changed (the host carries that one to the
   * simulation once, on 'up').
   */
  pointer(kind: TouchKind, x: number, y: number, c: ScreenContext, w: number, h: number): { handled: boolean; changed?: string }
}

interface Strip {
  n: number
  fader: ControlDef
  on: ControlDef | undefined
}

const PANEL = '#12151b'
const LINE = '#2a303b'
const INK = '#e8ecf3'
const DIM = '#7d8798'
const GREEN = '#46d36b'
const AMBER = '#f2b83a'
const RED = '#ff4d3d'
const ACCENT = '#5aa9ff'

/** The channel strips of a bank: every `fader-<n>` with its `ch<n>-on` key when it has one, in order. */
export function stripsOf(bank: ControlBank): Strip[] {
  const out: Strip[] = []
  for (const d of bank.all()) {
    const m = /^fader-(\d+)$/.exec(d.id)
    if (m && d.kind === 'fader') out.push({ n: Number(m[1]), fader: d, on: bank.def(`ch${m[1]}-on`) })
  }
  return out.sort((a, b) => a.n - b.n)
}

/** Geometry of a mixer-overview screen of w x h pixels with `count` strips (shared by draw and pointer, so a touch lands where it is drawn). */
export function overviewGeometry(w: number, h: number, count: number): { padX: number; top: number; stripW: number; track: { y0: number; y1: number }; onY: number; onH: number } {
  const padX = Math.round(w * 0.02)
  const top = Math.round(h * 0.16)
  const stripW = (w - padX * 2) / Math.max(1, count)
  return { padX, top, stripW, track: { y0: Math.round(h * 0.3), y1: Math.round(h * 0.84) }, onY: Math.round(h * 0.9), onH: Math.round(h * 0.07) }
}

export function createMixerOverview(): ScreenApp {
  /** The strip a touch is dragging. */
  let dragging: { strip: Strip } | null = null
  let touched: string | null = null

  const hit = (x: number, y: number, c: ScreenContext, w: number, h: number): { strip: Strip; part: 'fader' | 'on' } | null => {
    const strips = stripsOf(c.bank)
    const g = overviewGeometry(w, h, strips.length)
    const i = Math.floor((x - g.padX) / g.stripW)
    if (i < 0 || i >= strips.length) return null
    if (y >= g.track.y0 - 8 && y <= g.track.y1 + 8) return { strip: strips[i], part: 'fader' }
    if (y >= g.onY && y <= g.onY + g.onH && strips[i].on) return { strip: strips[i], part: 'on' }
    return null
  }

  const setFromY = (s: Strip, y: number, c: ScreenContext, h: number, count: number, w: number): void => {
    const g = overviewGeometry(w, h, count)
    const v = 1 - (y - g.track.y0) / (g.track.y1 - g.track.y0)
    c.bank.set(s.fader.id, v, 'user')
  }

  return {
    animated: true,
    draw(ctx, w, h, c) {
      const strips = stripsOf(c.bank)
      ctx.fillStyle = PANEL
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = INK
      ctx.font = `600 ${Math.round(h * 0.07)}px system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('MIX', Math.round(w * 0.02), Math.round(h * 0.07))
      ctx.fillStyle = DIM
      ctx.font = `${Math.round(h * 0.04)}px system-ui, sans-serif`
      ctx.fillText('Aperçu des voies · démo', Math.round(w * 0.02) + Math.round(h * 0.16), Math.round(h * 0.075))
      if (!strips.length) {
        ctx.fillText('Aucune voie', Math.round(w * 0.02), Math.round(h * 0.4))
        return
      }
      const g = overviewGeometry(w, h, strips.length)
      strips.forEach((s, i) => {
        const x0 = g.padX + i * g.stripW
        const cx = x0 + g.stripW / 2
        ctx.strokeStyle = LINE
        ctx.lineWidth = 1
        ctx.strokeRect(x0 + 2, g.top, g.stripW - 4, h - g.top - 6)
        // name
        ctx.fillStyle = INK
        ctx.textAlign = 'center'
        ctx.font = `600 ${Math.round(h * 0.045)}px system-ui, sans-serif`
        ctx.fillText(`${s.n}`, cx, g.top + Math.round(h * 0.04))
        // meter (post-fader level of the channel's bus) and fader track
        const v = c.bank.get(s.fader.id)
        const fdb = Math.max(-90, controlDb(s.fader, v))
        const on = s.on ? c.bank.get(s.on.id) >= 0.5 : true
        const level = on ? Math.max(-90, c.levels(`ch${s.n}`, c.nowMs / 1000) + Math.min(10, fdb)) : -90
        const meterX = x0 + g.stripW * 0.2
        const meterW = Math.max(4, g.stripW * 0.14)
        const segs = 16
        const lit = barLit(level, -120, segs, -54, 0).lit
        const segH = (g.track.y1 - g.track.y0) / segs
        for (let k = 0; k < segs; k++) {
          const y = g.track.y1 - (k + 1) * segH
          ctx.fillStyle = k < lit ? (k >= segs - 2 ? RED : k >= segs - 5 ? AMBER : GREEN) : '#1d222b'
          ctx.fillRect(meterX, y + 1, meterW, segH - 2)
        }
        const trackX = x0 + g.stripW * 0.62
        ctx.fillStyle = '#05070a'
        ctx.fillRect(trackX - 3, g.track.y0, 6, g.track.y1 - g.track.y0)
        const hy = g.track.y1 - v * (g.track.y1 - g.track.y0)
        ctx.fillStyle = on ? ACCENT : '#4b5565'
        ctx.fillRect(trackX - g.stripW * 0.16, hy - 7, g.stripW * 0.32, 14)
        ctx.fillStyle = INK
        ctx.font = `${Math.round(h * 0.036)}px system-ui, sans-serif`
        ctx.fillText(valueText(s.fader, v).replace(' dB', ''), cx, g.track.y0 - Math.round(h * 0.035))
        // ON key
        if (s.on) {
          ctx.fillStyle = on ? '#e5463b' : '#2a2f38'
          ctx.fillRect(x0 + 6, g.onY, g.stripW - 12, g.onH)
          ctx.fillStyle = on ? '#fff' : DIM
          ctx.font = `600 ${Math.round(h * 0.04)}px system-ui, sans-serif`
          ctx.fillText('ON', cx, g.onY + g.onH / 2)
        }
      })
    },
    pointer(kind, x, y, c, w, h) {
      const strips = stripsOf(c.bank)
      if (kind === 'down') {
        const t = hit(x, y, c, w, h)
        if (!t) return { handled: false }
        if (t.part === 'on') {
          c.bank.set(t.strip.on!.id, c.bank.get(t.strip.on!.id) >= 0.5 ? 0 : 1, 'user')
          return { handled: true, changed: t.strip.on!.id }
        }
        dragging = { strip: t.strip }
        touched = t.strip.fader.id
        setFromY(t.strip, y, c, h, strips.length, w)
        return { handled: true }
      }
      if (!dragging) return { handled: false }
      if (kind === 'move') {
        setFromY(dragging.strip, y, c, h, strips.length, w)
        return { handled: true }
      }
      const id = touched ?? undefined
      dragging = null
      touched = null
      return { handled: true, ...(id ? { changed: id } : {}) }
    },
  }
}

/** The apps a layout can name. */
export function createScreenApp(name: string): ScreenApp | null {
  return name === 'mixer-overview' ? createMixerOverview() : null
}
