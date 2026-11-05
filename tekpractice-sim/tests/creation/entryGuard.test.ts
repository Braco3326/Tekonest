/**
 * Night 2 wave 5, P1-1: the inline guard of index.html holds the only user strings that live outside copy.ts. They are in the deck (section « Textes hors COPY (index.html) »)
 * and the two must stay equal; the guard is plain JS (no module), shows nothing unless the entry script or a lazy chunk fails, and the reload link adds ?v=<time>.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
const deck = readFileSync(fileURLToPath(new URL('../../docs/copy/creation-mode.md', import.meta.url)), 'utf8')
const guard = html.slice(html.indexOf('Entry guard (night 2 wave 5'), html.indexOf('<script type="module" src="/src/main.ts">'))
const deckText = (key: string): string => deck.split('\n').find((l) => l.startsWith(`| \`${key}\` |`))!.split('|')[2].trim()
const inHtml = (name: string): string => new RegExp(`var ${name} = '([^']*)'`).exec(guard)![1]

describe('entry guard (index.html)', () => {
  it('its two strings are the deck rows, word for word', () => {
    expect(inHtml('TEXT')).toBe(deckText('index.html#entryFailure'))
    expect(inHtml('ACTION')).toBe(deckText('index.html#entryReload'))
    expect(inHtml('ACTION')).toBe(COPY.boot!.reload) // the same word as the lazy-chunk alert
  })
  it('the text is the one the brief gave', () => {
    expect(inHtml('TEXT')).toBe('Le jeu n’a pas pu se charger. Rechargez la page en forçant le rafraîchissement (Ctrl+F5) ou ouvrez-la de nouveau.')
  })
  it('it acts only until the app has started, only for the entry script, and its link is a full address (fix round C1, N1, N2)', () => {
    expect(guard).toContain('window.__tekBooted')
    expect(guard).toContain('window.__tekEntryFailed = show')
    expect(guard).toContain('a.href = url.href')
    expect(guard).toContain(String.raw`/\/(assets\/main-|src\/main\.)/`)
    // main.ts says the app has started, in both routes
    const main = readFileSync(fileURLToPath(new URL('../../src/main.ts', import.meta.url)), 'utf8')
    // the legacy route passes it as the fulfilment handler, the creation route calls it once the route chunk is here (before bootCreation): deleting either must fail this
    expect(main, 'legacy route: booted is the fulfilment handler').toContain('.then(booted,')
    expect(main, 'creation route: booted() is called when the route chunk has loaded').toMatch(/\.then\(\(m\) => \{\s*booted\(\)/)
    expect(main, 'and before bootCreation').toMatch(/booted\(\)[^\n]*\n\s*return m\.bootCreation\(\)/)
    expect(main).toContain('__tekEntryFailed')
  })
  it('it is a classic script placed before the entry module, listens to the entry error and to vite:preloadError, and adds the v query', () => {
    expect(guard.indexOf('<script>')).toBeGreaterThan(-1)
    expect(guard).toContain("addEventListener(\n          'error'")
    expect(guard).toContain('vite:preloadError')
    expect(guard).toContain("searchParams.set('v', String(Date.now()))")
    expect(guard).toContain("setAttribute('role', 'alert')")
    expect(guard).not.toMatch(/\bimport\b\s*[({]|\bexport\b/) // no module, no dependency
  })
})
