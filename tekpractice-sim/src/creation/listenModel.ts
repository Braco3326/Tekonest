/**
 * The Écoute block's view (Task 39): pure, no DOM. What the learner reads about the sound: the state, and for each speaker its level, gain, delay and
 * pan as TEXT (the bars are only a picture of the same numbers; colour or length is never the only cue).
 */
import type { MixVoice } from '../audio/listenerMix'
import { COPY } from './copy'

export type ListenState = 'stopped' | 'starting' | 'playing'

/** What is playing. A song's title is catalog data (content/songs.json); a file's name is the learner's own. */
export type ListenSource = { kind: 'test' } | { kind: 'file'; file: File } | { kind: 'song'; id: string; title: string; url: string }

export interface ListenRow {
  id: string
  name: string
  /** « QSC K12.2 (k12-g) : niveau −24,3 dBFS, gain −9,0 dB, retard 12 ms, pan gauche 42 % ». */
  text: string
  /** 0 (silence) … 1 (full scale) for the picture. */
  bar: number
}

export interface ListenView {
  /** The block exists (the engine chunk was asked for at least once). */
  shown: boolean
  state: ListenState
  /** « Lecture arrêtée. » / « Démarrage… » / « Lecture en cours : signal de test. » */
  line: string
  /** Playing, but every speaker is at 0 (mute, fader at −inf). */
  silent: boolean
  rows: ListenRow[]
  /** The transport button starts (true) or is off with `reason`. */
  canStart: boolean
  reason: string
}

const L = (): Readonly<Record<string, string>> => COPY.listen!

/** A French decimal with a true minus sign; never « −0,0 ». */
export function fr(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '–'
  const s = Math.abs(v) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : v.toFixed(digits)
  return s.replace('-', '−').replace('.', ',')
}

/** The source as the learner names it. */
export function sourceName(s: ListenSource): string {
  return s.kind === 'test' ? L().sourceTest! : s.kind === 'file' ? L().sourceFile!.replace('{name}', s.file.name) : L().sourceSong!.replace('{title}', s.title)
}

/** Below this an RMS is « silence » (−120 dBFS). */
const SILENT_RMS = 1e-6
/** The bar spans −60 dBFS … 0. */
const BAR_FLOOR_DB = -60

export const levelText = (rms: number): string => (rms < SILENT_RMS ? L().levelSilent! : L().levelDb!.replace('{v}', fr(20 * Math.log10(rms))))
export const barOf = (rms: number): number => (rms < SILENT_RMS ? 0 : Math.min(1, Math.max(0, (20 * Math.log10(rms) - BAR_FLOOR_DB) / -BAR_FLOOR_DB)))
export const gainText = (gain: number): string => (gain <= 0 ? L().levelSilent! : L().gainValue!.replace('{v}', fr(20 * Math.log10(gain))))
export const delayText = (delayS: number): string => L().delayValue!.replace('{v}', fr(delayS * 1000, 1))
export function panText(pan: number): string {
  const n = Math.round(Math.abs(pan) * 100)
  return n === 0 ? L().panCenter! : (pan < 0 ? L().panLeft! : L().panRight!).replace('{n}', String(n))
}

export function rowsOf(voices: readonly MixVoice[], levels: Readonly<Record<string, number>>, nameOf: (instanceId: string) => string): ListenRow[] {
  return [...voices]
    .sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0))
    .map((v) => {
      const name = nameOf(v.instanceId)
      const rms = levels[v.instanceId] ?? 0
      const text = L()
        .meterRow!.replace('{name}', name)
        .replace('{level}', levelText(rms))
        .replace('{gain}', gainText(v.gain))
        .replace('{delay}', delayText(v.delayS))
        .replace('{pan}', panText(v.pan))
      return { id: v.instanceId, name, text, bar: barOf(rms) }
    })
}

export const EMPTY_LISTEN_VIEW: ListenView = { shown: false, state: 'stopped', line: '', silent: false, rows: [], canStart: false, reason: '' }
