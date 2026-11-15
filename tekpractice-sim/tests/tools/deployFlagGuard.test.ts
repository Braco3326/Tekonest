import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { GUIDE_ON, INBOX_ON, PAGES_ON, PRODUCT_TABLE, findTestFlags, formatFlagRefusal, hasProductTable, scanOutputForTestFlags } from '../../tools/deploy-flag-guard.mjs'

/** The deploy build must prove its output holds no test switch: the guide inbox flag set to true in a feature table. Everything runs in the temp dir. */
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tmp = mkdtempSync(join(tmpdir(), 'deploy-flag-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe('INBOX_ON', () => {
  it.each(['{levels:!1,guide:!0,guideLegacy:!1,guideInbox:!0};function', 'guideInbox: true', 'guideInbox : true,', 'x={guideInbox:!0}', 'guideInbox:true}'])('matches %s', (text) => {
    expect(INBOX_ON.test(text)).toBe(true)
  })
  it.each(['{levels:!1,guide:!0,guideLegacy:!1,guideInbox:!1};function', 'guideInbox: false', 'guideInbox:!0x', 'guideInbox:trueish', 'guideLegacy:!0', 'inbox:!0', 'FEATURES.guideInbox === true'])('does not match %s', (text) => {
    expect(INBOX_ON.test(text)).toBe(false)
  })
})

describe('the assistant and the learning pages (founder 2026-11-15: off in the shipped product)', () => {
  it.each(['{levels:!1,legacyPages:!0,guide:!1,guideLegacy:!1,guideInbox:!1}', 'legacyPages: true', 'x={legacyPages:!0}'])('PAGES_ON matches %s', (text) => {
    expect(PAGES_ON.test(text)).toBe(true)
  })
  it.each(['{levels:!1,legacyPages:!1,guide:!1,guideLegacy:!1,guideInbox:!1}', 'legacyPages: false', 'legacyPages:!0x', 'legacyPagesX:!0'])('PAGES_ON does not match %s', (text) => {
    expect(PAGES_ON.test(text)).toBe(false)
  })
  it.each(['{levels:!1,legacyPages:!1,guide:!0,guideLegacy:!1,guideInbox:!1}', 'guide: true, guideLegacy: false', '{levels:false,guide:true,guideLegacy:false}'])('GUIDE_ON matches %s', (text) => {
    expect(GUIDE_ON.test(text)).toBe(true)
  })
  it.each(['{levels:!1,legacyPages:!1,guide:!1,guideLegacy:!1,guideInbox:!1}', 'guide: false, guideLegacy: false', 'guide:!0x,guideLegacy:!1', 'x={guide:!0,other:1}', 'FEATURES.guide === true'])('GUIDE_ON does not match %s', (text) => {
    expect(GUIDE_ON.test(text)).toBe(false)
  })
  it('a deploy output is refused when the table is the all-on one, and passes with the product table', () => {
    expect(findTestFlags([{ path: 'assets/a.js', text: 'x={levels:!1,legacyPages:!0,guide:!0,guideLegacy:!1,guideInbox:!1}' }])).toEqual(['assets/a.js'])
    expect(findTestFlags([{ path: 'assets/a.js', text: 'x={levels:!1,legacyPages:!1,guide:!1,guideLegacy:!1,guideInbox:!1}' }])).toEqual([])
  })
  it('the product table must be there: an output with no feature table at all is not proved clean', () => {
    expect(PRODUCT_TABLE.test('x={levels:!1,legacyPages:!1,guide:!1,guideLegacy:!1,guideInbox:!1};')).toBe(true)
    expect(PRODUCT_TABLE.test('x={levels:!1,legacyPages:!1,guide:!0,guideLegacy:!1,guideInbox:!1};')).toBe(false)
    expect(PRODUCT_TABLE.test('nothing here')).toBe(false)
  })
})

describe('findTestFlags', () => {
  it('returns the paths of the files with the flag on, and none for a clean output', () => {
    expect(findTestFlags([{ path: 'assets/a.js', text: 'guideInbox:!1' }, { path: 'assets/b.js', text: 'x;guideInbox:!0}' }, { path: 'assets/c.js', text: '' }])).toEqual(['assets/b.js'])
    expect(findTestFlags([])).toEqual([])
    expect(findTestFlags([{ path: 'a.js', text: undefined as unknown as string }])).toEqual([])
  })
})

describe('scanOutputForTestFlags', () => {
  const out = (files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmp, 'o-'))
    for (const [name, text] of Object.entries(files)) {
      const p = join(dir, name)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, text)
    }
    return dir
  }

  it('is clean for an output with the flag off, and reads only javascript', () => {
    expect(scanOutputForTestFlags(out({ 'assets/main-1.js': 'x={guideInbox:!1}', 'assets/note.txt': 'guideInbox:!0', 'index.html': 'guideInbox:!0' }))).toEqual([])
  })

  it('finds the flag in any chunk, in a folder too, with forward slashes', () => {
    expect(scanOutputForTestFlags(out({ 'assets/main-1.js': 'x={guideInbox:!1}', 'assets/deep/main-2.js': 'x={guideInbox:!0}', 'a.mjs': 'guideInbox: true' })).sort()).toEqual(['a.mjs', 'assets/deep/main-2.js'])
  })

  it('hasProductTable: the feature table of the product is in the output, with the assistant and the learning pages off', () => {
    expect(hasProductTable(out({ 'assets/boot-1.js': 'a;x={levels:!1,legacyPages:!1,guide:!1,guideLegacy:!1,guideInbox:!1};b' }))).toBe(true)
    expect(hasProductTable(out({ 'assets/boot-1.js': 'x={levels:!1,legacyPages:!0,guide:!0,guideLegacy:!1,guideInbox:!1}' }))).toBe(false)
    expect(hasProductTable(out({ 'assets/boot-1.js': 'no table', 'a.html': 'levels:!1,legacyPages:!1,guide:!1,guideLegacy:!1' }))).toBe(false)
  })

  it('the refusal names the files and never the text', () => {
    const msg = formatFlagRefusal(['assets/main-1.js'])
    expect(msg).toContain('assets/main-1.js')
    expect(msg).toContain('REFUSED')
    expect(msg).not.toContain('guideInbox:!0')
  })
})

// When local builds exist, the check is also run on the real thing: the normal build is clean, the flag-on test build is caught (see vite.config.ts).
describe.skipIf(!existsSync(join(root, 'dist-site', 'assets')) && !existsSync(join(root, 'dist', 'guide-inbox-test', 'assets')))('the real builds', () => {
  it.skipIf(!existsSync(join(root, 'dist-site', 'assets')))('the deploy build output (dist-site) is clean and carries the product table', () => {
    expect(scanOutputForTestFlags(join(root, 'dist-site', 'assets'))).toEqual([])
    expect(hasProductTable(join(root, 'dist-site', 'assets'))).toBe(true)
  })
  it.skipIf(!existsSync(join(root, 'dist', 'guide-inbox-test', 'assets')))('the flag-on test build is caught', () => {
    expect(scanOutputForTestFlags(join(root, 'dist', 'guide-inbox-test', 'assets')).length).toBeGreaterThan(0)
  })
})
