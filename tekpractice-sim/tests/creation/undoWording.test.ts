/**
 * Mission 3 fixes, item 3 (review finding A): on a phone there is no Ctrl key, so the undo wording names the « Annuler » command (menu Projet) instead of
 * « Ctrl+Z », in every status line, toast, dialog and report that names the undo. One detector of a coarse pointer (the query the app already used in two
 * places), one label, one filler. On a fine pointer every string is byte-identical to before.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { coarsePointer } from '../../src/creation/input/coarsePointer'
import { fillUndo, undoLabelFor } from '../../src/creation/undoWording'

const ROOT = join(__dirname, '..', '..')
const TOUCH = '« Annuler » (menu Projet)'
const stubWin = (coarse: boolean) => ({ matchMedia: (q: string) => ({ matches: coarse && q === '(pointer: coarse)' }) }) as unknown as Window

/** Every COPY string that names the undo key. */
const templates: [string, string][] = Object.entries(COPY as Record<string, Record<string, string>>).flatMap(([s, e]) =>
  Object.entries(e)
    .filter(([, t]) => t.includes('{undo}'))
    .map(([k, t]) => [`${s}.${k}`, t] as [string, string]),
)

describe('coarsePointer: the app’s one coarse-pointer detector', () => {
  it('reads (pointer: coarse); false without a window or without matchMedia', () => {
    expect(coarsePointer(stubWin(true))).toBe(true)
    expect(coarsePointer(stubWin(false))).toBe(false)
    expect(coarsePointer(null)).toBe(false)
    expect(coarsePointer({} as Window)).toBe(false)
  })
  it('is the only place the query is written in src (boot.ts and the 2D page call it)', () => {
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) walk(p)
        else if (n.endsWith('.ts') && readFileSync(p, 'utf8').includes("matchMedia?.('(pointer: coarse)')")) hits.push(p.slice(ROOT.length + 1).replace(/\\/g, '/'))
      }
    }
    walk(join(ROOT, 'src'))
    expect(hits).toEqual(['src/creation/input/coarsePointer.ts'])
  })
})

describe('undoLabelFor', () => {
  it('fine pointer: the key’s own label, untouched; coarse pointer: « Annuler » (menu Projet)', () => {
    expect(undoLabelFor('Ctrl+Z', false)).toBe('Ctrl+Z')
    expect(undoLabelFor('Cmd+Z', false)).toBe('Cmd+Z')
    expect(undoLabelFor('Ctrl+Z', true)).toBe(TOUCH)
    expect(COPY.undoTouch!.label).toBe(TOUCH)
  })
})

describe('fillUndo over every COPY string that names the undo', () => {
  it('there are such strings (status lines, dialogs, the 2D report, the tracing)', () => {
    expect(templates.length).toBeGreaterThanOrEqual(15)
  })
  it.each(templates)('%s: with the key, byte-identical to the old fill', (_k, t) => {
    expect(fillUndo(t, 'Ctrl+Z')).toBe(t.replace('{undo}', 'Ctrl+Z'))
  })
  it.each(templates)('%s: on touch, no key name, « Annuler » named, and never « Annuler … pour annuler »', (_k, t) => {
    const s = fillUndo(t, TOUCH)
    expect(s).not.toMatch(/Ctrl|Cmd|\{undo\}/)
    expect(s).toContain(TOUCH)
    expect(s).not.toMatch(/Annuler » \(menu Projet\) pour annuler/)
  })
  it('the words, exactly (status line, 2D report, replace dialog)', () => {
    expect(fillUndo(COPY.placement!.statusPlaced!, TOUCH)).toBe('Posé : {device}. « Annuler » (menu Projet) pour revenir en arrière.')
    expect(fillUndo(COPY.plan2d!.reportAdded!, TOUCH)).toBe('Ajoutés dans la scène 3D : {devices} et {cables}, aux mêmes places. « Annuler » (menu Projet) dans la scène 3D les retire en une fois.')
    expect(fillUndo(COPY.plan2d!.spawnReplaceBody!, TOUCH)).toBe('Le matériel déjà dans la scène 3D sera retiré, puis celui du schéma posé aux mêmes places. « Annuler » (menu Projet) dans la scène 3D permet de revenir en arrière.')
    expect(fillUndo(COPY.place!.replaceBody!, TOUCH)).toBe('Ce modèle installe son propre matériel : celui déjà en place sera retiré. « Annuler » (menu Projet) permet de revenir en arrière.')
  })
})

describe('every site goes through fillUndo (a raw « {undo} » replace would bring « Ctrl+Z » back on a phone)', () => {
  it('no source file replaces {undo} by hand, nor falls back to a raw « Ctrl+Z » in a message', () => {
    const bad: string[] = []
    const walk = (dir: string): void => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) {
          if (n !== 'guide') walk(p)
        } else if (n.endsWith('.ts')) {
          const src = readFileSync(p, 'utf8')
          if (/replace\('\{undo\}'/.test(src) || /\bundo: [a-zA-Z.?!()]*undoLabel/.test(src)) bad.push(p.slice(ROOT.length + 1).replace(/\\/g, '/'))
        }
      }
    }
    walk(join(ROOT, 'src'))
    expect(bad).toEqual([])
  })
})
