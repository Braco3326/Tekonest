import { describe, expect, it } from 'vitest'
import {
  ALL_LEGAL_TEXTS,
  CONSENT_TEXT,
  DATA_ITEMS,
  DRAFT_MARK,
  PARENT_CONFIRMATION_TEXT,
  PRIVACY_SECTIONS,
  headingOf,
  plainText,
} from '../../src/accounts/consentCopy'
import { PROFILE_KEYS } from '../../src/accounts/profileModel'

const section = (id: string) => {
  const s = PRIVACY_SECTIONS.find((x) => x.id === id)
  if (!s) throw new Error('missing section ' + id)
  return plainText(s)
}

describe('legal drafts', () => {
  it('every section of the notice, the consent text and the parent text carries « à valider »', () => {
    expect(DRAFT_MARK).toBe('à valider')
    expect(ALL_LEGAL_TEXTS.length).toBe(PRIVACY_SECTIONS.length + 2)
    for (const s of ALL_LEGAL_TEXTS) {
      expect(s.mark, s.id).toBe(DRAFT_MARK)
      expect(headingOf(s), s.id).toContain('à valider')
    }
  })

  it('covers who, purposes, legal basis, data, hosting, retention, rights, under 15 and contact', () => {
    expect(PRIVACY_SECTIONS.map((s) => s.id)).toEqual(['responsable', 'finalites', 'base-legale', 'donnees', 'hebergement', 'conservation', 'droits', 'moins-de-15-ans', 'contact'])
  })

  it('the controller is Tekonest, in France, with no blank left anywhere; the contact is the routed address', () => {
    const r = section('responsable')
    expect(PRIVACY_SECTIONS.find((s) => s.id === 'responsable')!.paragraphs).toEqual(['Le responsable du traitement de vos données est Tekonest, en France.'])
    expect(r).not.toMatch(/à titre personnel/)
    for (const s of ALL_LEGAL_TEXTS) expect(plainText(s), s.id).not.toMatch(/[[\]]/)
    expect(section('contact')).toContain('privacy@tekonest.com')
  })

  it('the password is described as irreversibly transformed (a one-way hash), not « chiffré »', () => {
    const pw = DATA_ITEMS.find((d) => d.key === 'password')!
    expect(pw.label).toBe('votre mot de passe (transformé de façon irréversible par le service de connexion ; il n’est pas lisible)')
    for (const s of ALL_LEGAL_TEXTS) expect(plainText(s), s.id).not.toMatch(/chiffrée/)
  })

  it('purposes: the account only (profile and goal), projects stay on the device; no advertising, no sale', () => {
    const t = section('finalites')
    expect(t).toMatch(/une seule chose/)
    expect(t).toMatch(/compte/)
    expect(t).toMatch(/profil et votre but/)
    expect(t).toMatch(/Vos projets restent sur votre appareil/)
    expect(t).not.toMatch(/enregistrer vos projets|sauvegarder vos projets/)
    expect(t).toMatch(/aucune publicité/i)
    expect(t).toMatch(/vend|vente/i)
  })

  it('legal basis is consent and can be withdrawn', () => {
    const t = section('base-legale')
    expect(t).toMatch(/consentement/)
    expect(t).toMatch(/retirer/)
  })

  it('names the EU hosting, the host and the city', () => {
    const t = section('hebergement')
    expect(t).toMatch(/Supabase/)
    expect(t).toMatch(/Francfort \(Allemagne\)/)
    expect(t).toMatch(/Union européenne/)
    expect(t).not.toMatch(/à confirmer/)
  })

  it('retention: until the account is deleted', () => {
    expect(section('conservation')).toMatch(/jusqu’à la suppression/)
  })

  it('lists every right and the complaint to the CNIL', () => {
    const t = section('droits')
    for (const w of ['accès', 'rectification', 'effacement', 'portabilité', 'retirer', 'CNIL']) expect(t, w).toContain(w)
  })

  it('under 15: a parent confirmation', () => {
    expect(section('moins-de-15-ans')).toMatch(/parent/)
  })
})

describe('the data listed is exactly the data collected', () => {
  it('lists the e-mail, the sign-in secret and every profile key, nothing else', () => {
    const keys = DATA_ITEMS.map((d) => d.key).sort()
    expect(keys).toEqual([...PROFILE_KEYS, 'email', 'password'].sort())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('the data section prints every item label', () => {
    const t = section('donnees')
    for (const d of DATA_ITEMS) expect(t, d.key).toContain(d.label)
  })

  it('says plainly what is not collected', () => {
    expect(section('donnees')).toMatch(/pas de date de naissance/)
    expect(section('donnees')).toMatch(/employeur/)
  })
})

describe('voice', () => {
  it('speaks to « vous », never in the first person, with no emoji', () => {
    for (const s of ALL_LEGAL_TEXTS) {
      const t = plainText(s)
      // Button labels quoted with « » are the interface's own names (« Mon compte »), not the text's voice.
      expect(t.replace(/«[^»]*»/g, ''), s.id).not.toMatch(/(^|[\s(«])(je|j’|mon|ma|mes|moi|nous|notre|nos)(\s|$|’)/i)
      expect(t, s.id).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(t.length, s.id).toBeGreaterThan(20)
    }
  })

  it('the consent text is a statement to tick, mentioning the data and the purposes', () => {
    const t = plainText(CONSENT_TEXT)
    expect(t).toMatch(/Vous acceptez/)
    expect(t).toMatch(/compte/)
    expect(t).not.toMatch(/projets/)
    expect(plainText(PARENT_CONFIRMATION_TEXT)).toMatch(/Vous confirmez/)
  })
})
