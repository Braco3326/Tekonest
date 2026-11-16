// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { DATA_ITEMS, PRIVACY_POLICY_URL, PRIVACY_SECTIONS, plainText } from '../../src/accounts/consentCopy'
import { NNBSP, plain, renderPrivacyPage } from '../../tools/privacyPage'
import {
  PAGE_DATA_LABEL_OVERRIDES,
  PRIVACY_INCLUDES,
  PRIVACY_PAGE_PATH,
  type PrivacyIncludes,
  SIGN_UP_NOT_OPEN,
  pageDataItems,
  policySections,
} from '../../src/accounts/privacyPolicy'
import { privacyPageFile, writePrivacyPage } from '../../tools/build-privacy-page'

const ALL_ON: PrivacyIncludes = { resend: true, google: true, signUpOpen: true }
const doc = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')
/** The visible text, with the narrow no-break spaces of French typography folded back to plain spaces. */
const textOf = (html: string): string => (doc(html).body.textContent ?? '').split(NNBSP).join(' ').replace(/\s+/g, ' ')
const dialogText = (id: string): string => plainText(PRIVACY_SECTIONS.find((s) => s.id === id)!)
const pageSection = (id: string, inc: PrivacyIncludes = PRIVACY_INCLUDES): string => {
  const s = policySections(inc).find((x) => x.id === id)
  if (!s) throw new Error('no page section ' + id)
  return plain(
    [s.title, ...s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.kind === 'ul' ? b.items : [b.caption, ...b.head, ...b.rows.flat()]))].join('\n')
  )
}
const html = renderPrivacyPage()
const page = textOf(html)

describe('this release: accounts OFF, Resend and Google not live', () => {
  it('the switches are the release defaults', () => {
    expect(PRIVACY_INCLUDES).toEqual({ resend: false, google: false, signUpOpen: false })
  })

  it('with them off, « Resend » and « Google » appear nowhere in the page (text, attributes, markup)', () => {
    expect(html).not.toMatch(/resend/i)
    expect(html).not.toMatch(/google/i)
  })

  it('with them on, both appear (the accounts release flips them, one change each)', () => {
    const on = renderPrivacyPage({ includes: ALL_ON })
    const t = textOf(on)
    expect(t).toContain('Resend : envoie les e-mails de service')
    expect(t).toContain('Google : seulement si vous choisissez « Continuer avec Google ».')
    expect(t).toContain('Si vous vous connectez avec Google')
    expect(t).toContain('Cloudflare, Google et Resend sont des sociétés américaines')
    expect(renderPrivacyPage({ includes: { ...PRIVACY_INCLUDES, resend: true } })).not.toMatch(/google/i)
    expect(renderPrivacyPage({ includes: { ...PRIVACY_INCLUDES, google: true } })).not.toMatch(/resend/i)
  })

  it('section 6 names Cloudflare only, as an American company, under the GDPR safeguards, with no unconfirmed framework', () => {
    const t = pageSection('transferts')
    expect(t).toContain('Cloudflare est une société américaine')
    expect(t).toContain('Ces transferts sont encadrés par les garanties prévues par le RGPD.')
    expect(t).not.toMatch(/Data Privacy Framework|clauses contractuelles|à vérifier/i)
  })

  it('section 3 opens with the sentence that sign-up is not open yet; it goes when signUpOpen is flipped', () => {
    const s = policySections().find((x) => x.id === 'donnees')!
    expect(s.blocks[0]).toEqual({ kind: 'p', text: SIGN_UP_NOT_OPEN })
    expect(page).toContain('La création de compte n’est pas encore ouverte : tant qu’elle ne l’est pas, rien n’est envoyé au service de comptes.')
    expect(textOf(renderPrivacyPage({ includes: ALL_ON }))).not.toContain('pas encore ouverte')
  })

  it('no bracketed sentence is left: no « [ » or « ] » anywhere, in both variants', () => {
    for (const h of [html, renderPrivacyPage({ includes: ALL_ON })]) expect(textOf(h)).not.toMatch(/[[\]]/)
    expect(page).not.toMatch(/Proposition|à confirmer|à vérifier|3 ans|un an au plus/)
  })
})

describe('the page and the dialog say the same thing', () => {
  it('the controller: Tekonest, in France, the very sentence of the dialog', () => {
    const sentence = 'Le responsable du traitement de vos données est Tekonest, en France.'
    expect(dialogText('responsable')).toContain(sentence)
    expect(pageSection('responsable')).toContain(sentence)
    expect(page).toContain(sentence)
  })

  it('the hosting: Supabase, Francfort (Allemagne), in the EU', () => {
    for (const t of [dialogText('hebergement'), pageSection('destinataires')]) {
      expect(t).toContain('Supabase')
      expect(t).toContain('Francfort (Allemagne)')
      expect(t).toContain('dans l’Union européenne')
    }
  })

  it('the address: privacy@tekonest.com, a mailto link on the page', () => {
    expect(dialogText('contact')).toContain('privacy@tekonest.com')
    expect(pageSection('responsable')).toContain('privacy@tekonest.com')
    const links = [...doc(html).querySelectorAll('a[href^="mailto:"]')]
    expect(links.length).toBeGreaterThan(0)
    for (const a of links) expect(a.getAttribute('href')).toBe('mailto:privacy@tekonest.com')
  })

  it('the data list: every DATA_ITEMS key maps to one page item, same order; same label unless the page words it on purpose', () => {
    const items = pageDataItems()
    expect(items.map((i) => i.key)).toEqual([...DATA_ITEMS.map((d) => d.key), 'technical'])
    for (const d of DATA_ITEMS) {
      const item = items.find((i) => i.key === d.key)!
      if (PAGE_DATA_LABEL_OVERRIDES[d.key] === undefined) expect(item.text, d.key).toBe(d.label)
      expect(page, d.key).toContain(item.text)
    }
    expect(Object.keys(PAGE_DATA_LABEL_OVERRIDES)).toEqual(['password'])
    const pw = 'transformé de façon irréversible par le service de connexion'
    expect(DATA_ITEMS.find((d) => d.key === 'password')!.label).toContain(pw)
    expect(items.find((i) => i.key === 'password')!.text).toContain(pw)
    const list = [...doc(html).querySelectorAll('ul')].find((u) => u.textContent?.includes('votre adresse e-mail'))!
    expect(list.querySelectorAll('li').length).toBe(DATA_ITEMS.length + 1)
  })

  it('what is NOT collected: the same four things', () => {
    for (const t of [dialogText('donnees'), pageSection('donnees')]) {
      for (const w of ['date de naissance', 'numéro de téléphone', 'adresse postale', 'employeur']) expect(t, w).toContain(w)
    }
  })

  it('under 15: a parent or guardian confirmation, else no account and play goes on without one', () => {
    for (const t of [dialogText('moins-de-15-ans'), pageSection('moins-de-15-ans')]) {
      expect(t).toMatch(/moins de 15 ans/)
      expect(t).toContain('confirmation d’un parent ou d’un tuteur')
      expect(t).toMatch(/sans compte/)
    }
  })

  it('deletion: « Supprimer mon compte », in both', () => {
    expect(dialogText('conservation')).toContain('« Supprimer mon compte »')
    expect(pageSection('conservation')).toContain('« Supprimer mon compte »')
    expect(pageSection('droits')).toContain('« Supprimer mon compte »')
  })

  it('the complaint: the CNIL (cnil.fr), in both', () => {
    expect(dialogText('droits')).toContain('CNIL (cnil.fr)')
    expect(pageSection('droits')).toContain('CNIL (cnil.fr)')
  })

  it('the dialog links to this very page', () => {
    expect(PRIVACY_POLICY_URL).toBe('https://tekonest.com' + PRIVACY_PAGE_PATH)
    expect(PRIVACY_PAGE_PATH).toBe('/tekpractice/confidentialite/')
  })
})

describe('voice (Ruling: the page speaks as Tekonest, « nous »; the dialog keeps « vous » only)', () => {
  it('no first person singular on the page, outside the interface names quoted in « »; « nous » is allowed', () => {
    const t = page.replace(/«[^»]*»/g, '')
    expect(t).not.toMatch(/(^|[\s(])(je|j’|mon|ma|mes|moi)(\s|$|’)/i)
    expect(t).toMatch(/\bnous\b/)
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('the draft mark sits in ONE place', () => {
  it('this release: « à valider » in the <title> and the <h1>, and the update line', () => {
    const d = doc(html)
    expect(d.title).toContain('à valider')
    expect(d.querySelector('h1')!.textContent).toContain('à valider')
    expect(page).toContain('Dernière mise à jour : 16 novembre 2026')
  })

  it('draft off: « à valider » appears nowhere', () => {
    expect(renderPrivacyPage({ draft: false })).not.toContain('à valider')
  })
})

describe('HTML basics and accessibility', () => {
  const d = doc(html)

  it('French, a title, a description, robots, one h1, headings in order', () => {
    expect(d.documentElement.getAttribute('lang')).toBe('fr')
    expect(d.title.length).toBeGreaterThan(10)
    expect(d.querySelector('meta[name="description"]')!.getAttribute('content')!.length).toBeGreaterThan(40)
    expect(d.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('index')
    expect(d.querySelector('meta[name="viewport"]')).not.toBeNull()
    expect(d.querySelectorAll('h1').length).toBe(1)
    const levels = [...d.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1)
    expect(d.querySelectorAll('h2').length).toBe(12)
  })

  it('landmarks and a skip link to the main content', () => {
    expect(d.querySelectorAll('header').length).toBe(1)
    expect(d.querySelectorAll('main').length).toBe(1)
    expect(d.querySelectorAll('footer').length).toBe(1)
    for (const n of d.querySelectorAll('nav')) expect(n.getAttribute('aria-label')).toBeTruthy()
    const skip = d.body.firstElementChild as HTMLAnchorElement
    expect(skip.getAttribute('href')).toBe('#contenu')
    expect(d.getElementById('contenu')!.tagName).toBe('MAIN')
  })

  it('section 4 is a real table: a caption, three column headers, a row header per row', () => {
    const tables = d.querySelectorAll('table')
    expect(tables.length).toBe(1)
    const t = tables[0]
    expect(t.querySelector('caption')!.textContent!.length).toBeGreaterThan(10)
    expect([...t.querySelectorAll('thead th')].map((th) => th.getAttribute('scope'))).toEqual(['col', 'col', 'col'])
    const rows = t.querySelectorAll('tbody tr')
    expect(rows.length).toBe(4)
    for (const r of rows) {
      expect(r.querySelector('th')!.getAttribute('scope')).toBe('row')
      expect(r.querySelectorAll('td').length).toBe(2)
    }
  })

  it('every link has text and an href; ids are unique', () => {
    for (const a of d.querySelectorAll('a')) {
      expect(a.getAttribute('href'), a.outerHTML).toBeTruthy()
      expect((a.textContent ?? '').trim().length || a.querySelector('img[alt]:not([alt=""])'), a.outerHTML).toBeTruthy()
    }
    const ids = [...d.querySelectorAll('[id]')].map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const img of d.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true)
  })

  it('no external URL but https://www.cnil.fr; no third-party script, no inline script, no cookie', () => {
    const urls = [...d.querySelectorAll('[href], [src]')].map((e) => e.getAttribute('href') ?? e.getAttribute('src')!)
    for (const u of urls) {
      const ok = u.startsWith('/') || u.startsWith('#') || u === 'mailto:privacy@tekonest.com' || u === 'https://www.cnil.fr'
      expect(ok, u).toBe(true)
      expect(u.startsWith('//'), u).toBe(false)
    }
    expect([...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((m) => m[0])).toEqual(['https://www.cnil.fr'])
    const scripts = [...d.querySelectorAll('script')]
    expect(scripts.map((s) => s.getAttribute('src'))).toEqual(['/assets/js/site.js'])
    expect(scripts.every((s) => (s.textContent ?? '').trim() === '')).toBe(true)
    expect(html).not.toMatch(/cookie\s*=|document\.cookie|gtag|analytics|@import/i)
  })

  it('is deterministic', () => {
    expect(renderPrivacyPage()).toBe(html)
  })
})

describe('the generator (run by npm run build:site)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'privacy-page-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  it('writes tekpractice/confidentialite/index.html under the output root, with the rendered page', () => {
    const file = writePrivacyPage(tmp)
    expect(file).toBe(privacyPageFile(tmp))
    expect(file.split('\\').join('/').endsWith('/tekpractice/confidentialite/index.html')).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe(renderPrivacyPage())
  })

  it('build-site.mjs runs it and refuses to finish without the page', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'tools', 'build-site.mjs'), 'utf8')
    expect(src).toContain("'build-privacy-page.ts'")
    expect(src).toContain("join(root, 'dist-site-pages')")
    expect(src).toMatch(/REFUSED: the privacy page was not generated/)
  })
})
