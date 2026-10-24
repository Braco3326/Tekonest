import { describe, expect, it } from 'vitest'
import { createTrial, type Trial } from '../../src/trials/trial'
import {
  caption,
  compareView,
  currentRow,
  essaisRows,
  exportFileName,
  freezeDecision,
  frozenTime,
  importNotice,
  limitCounter,
  liveState,
  loadNotice,
  nextTrialName,
  orbitView,
  writeFailure,
  YEAR1_MAX,
} from '../../src/trials/essaisViewModel'
import { ORBIT_FEEL } from '../../src/camera/orbitFeel'
import { design, input, NOW } from './fixtures'

const at = (h: number, m: number): string => new Date(2026, 9, 24, h, m).toISOString()

async function trial(id: string, name: string, frozenAt: string, parent: Trial | null = null, over: Partial<Parameters<typeof input>[0]> = {}): Promise<Trial> {
  const d = design()
  // a distinct design per trial: move the mic by the trial's index
  d.placements[0].position_m = [id.length + name.charCodeAt(0) / 100, 1.2, -3]
  return createTrial(
    input({ name, design: d, parent, evidence: { ...input().evidence, prediction: { text: `prédiction ${name}`, writtenAt: '2026-01-01T00:00:00.000Z' } }, ...over }),
    frozenAt,
    id,
  )
}

describe('nextTrialName', () => {
  it('names Essais A, B, C… in order, skipping names already used', async () => {
    expect(nextTrialName([])).toBe('A')
    const a = await trial('t1', 'A', NOW)
    const c = await trial('t3', 'C', NOW)
    expect(nextTrialName([a])).toBe('B')
    expect(nextTrialName([a, c])).toBe('B')
  })
  it('goes on with AA after Z', () => {
    const named = Array.from({ length: 26 }, (_, i) => ({ name: String.fromCharCode(65 + i) }))
    expect(nextTrialName(named)).toBe('AA')
  })
})

describe('frozenTime', () => {
  it('shows the local hour and minutes', () => {
    expect(frozenTime(at(10, 5))).toBe('figé à 10:05')
    expect(frozenTime(at(9, 42))).toBe('figé à 09:42')
  })
})

describe('essaisRows', () => {
  it('2nd year: a mini-tree, children indented under their parent, siblings by freeze time', async () => {
    const a = await trial('ta', 'A', at(10, 0))
    const b = await trial('tb', 'B', at(10, 5), a)
    const c = await trial('tc', 'C', at(10, 10))
    const b1 = await trial('tb1', 'D', at(10, 7), b)
    const rows = essaisRows([c, b1, b, a], { year: 2, displayedId: 'tb', selectedId: 'tc' })
    expect(rows.map((r) => [r.label, r.depth])).toEqual([
      ['Essai A', 0],
      ['Essai B', 1],
      ['Essai D', 2],
      ['Essai C', 0],
    ])
    expect(rows.find((r) => r.id === 'tb')).toMatchObject({ displayed: true, hasChildren: true })
    expect(rows.find((r) => r.id === 'tc')).toMatchObject({ selected: true, displayed: false, hasChildren: false })
  })

  it('1st year: a flat list in freeze order', async () => {
    const a = await trial('ta', 'A', at(10, 0))
    const b = await trial('tb', 'B', at(10, 5), a)
    const rows = essaisRows([b, a], { year: 1, displayedId: null, selectedId: null })
    expect(rows.map((r) => [r.label, r.depth])).toEqual([
      ['Essai A', 0],
      ['Essai B', 0],
    ])
  })

  it('an orphan (parent not in the list) is a root', async () => {
    const a = await trial('ta', 'A', at(10, 0))
    const b = await trial('tb', 'B', at(10, 5), a)
    expect(essaisRows([b], { year: 2, displayedId: null, selectedId: null })[0].depth).toBe(0)
  })

  it('flags an Essai that changed several things at once', async () => {
    const a = await trial('ta', 'A', at(10, 0))
    const d = design()
    d.placements[0].position_m = [5, 1.2, -3]
    d.rig.connections.pop()
    const b = await createTrial(input({ name: 'B', design: d, parent: a }), '2026-12-01T00:00:00.000Z', 'tb')
    const rows = essaisRows([a, b], { year: 2, displayedId: null, selectedId: null })
    expect(rows[1].multiChange).toBe(true)
    expect(rows[0].multiChange).toBe(false)
  })

  it('picking a device up and putting it down elsewhere is ONE change (a move), not several', async () => {
    const a = await trial('ta', 'A', at(10, 0))
    const d = design()
    // spk-l picked up (its cable goes with it) and put down again as a new instance
    d.rig.instances = d.rig.instances.map((i) => (i.instanceId === 'spk-l' ? { instanceId: 'spk-l2', deviceId: i.deviceId } : i))
    d.rig.connections = d.rig.connections.filter((c) => c.b.instance !== 'spk-l')
    d.placements = d.placements.map((p) => (p.instanceId === 'spk-l' ? { ...p, instanceId: 'spk-l2', position_m: [3, 2.2, -9] } : p))
    d.placements[0].position_m = a.design.placements[0].position_m.slice() as [number, number, number]
    const b = await createTrial(input({ name: 'B', design: d, parent: a }), '2026-12-01T00:00:00.000Z', 'tb')
    expect(b.evidence.changedSinceParent).toEqual(['instance:+spk-l2', 'instance:-spk-l', 'connection:-1'])
    // the cable left with the device: still one learner action
    expect(essaisRows([a, b], { year: 2, displayedId: null, selectedId: null })[1].multiChange).toBe(false)
  })
})

describe('live state, current row, caption', () => {
  it('no displayed Essai → "pas encore figé"', () => {
    expect(liveState(null, 'fp1:x')).toBe('none')
    expect(currentRow(null, 'none')).toEqual({ title: 'Montage actuel', text: 'pas encore figé' })
    expect(caption({ displayed: null, state: 'none', comparing: null })).toBe('Affiché : Montage actuel · pas encore figé')
  })

  it('fresh vs modified, from the live fingerprint', async () => {
    const a = await trial('ta', 'A', NOW)
    expect(liveState(a, a.fingerprint)).toBe('fresh')
    expect(liveState(a, null)).toBe('fresh') // not recomputed yet: keep the last known state
    expect(liveState(a, 'fp1:other')).toBe('modified')
    expect(currentRow(a, 'fresh').text).toBe("identique à l'essai A")
    expect(currentRow(a, 'modified').text).toBe("modifié depuis l'essai A")
    expect(caption({ displayed: a, state: 'fresh', comparing: null })).toBe('Affiché : Essai A · Montage actuel : à jour')
    expect(caption({ displayed: a, state: 'modified', comparing: null })).toBe(
      'Affiché : Essai A · Résultat à refaire · Montage actuel : modifié',
    )
  })

  it('compare: the caption says which Essai is shown, read-only', async () => {
    const a = await trial('ta', 'A', NOW)
    expect(caption({ displayed: null, state: 'none', comparing: a })).toBe('Affiché : Essai A · comparaison en lecture seule')
  })
})

describe('freezeDecision', () => {
  const refs = (t: Trial) => ({ rulesRev: t.evidence.rulesRev, room: t.consumed.room })

  it('no-op when the fingerprint AND the content refs equal the displayed Essai', async () => {
    const a = await trial('ta', 'A', NOW)
    expect(freezeDecision({ trials: [a], displayed: a, liveFp: a.fingerprint, refs: refs(a), year: 2 })).toEqual({ kind: 'noop', name: 'A' })
  })

  it('freezes again when only the refs changed (catalog rules or room geometry)', async () => {
    const a = await trial('ta', 'A', NOW)
    const d = freezeDecision({ trials: [a], displayed: a, liveFp: a.fingerprint, refs: { ...refs(a), rulesRev: 'r1:new' }, year: 2 })
    expect(d).toEqual({ kind: 'ok', name: 'B', parentId: 'ta' })
    const g = freezeDecision({
      trials: [a],
      displayed: a,
      liveFp: a.fingerprint,
      refs: { ...refs(a), room: { roomId: a.consumed.room.roomId, geometryRev: 'g2' } },
      year: 2,
    })
    expect(g.kind).toBe('ok')
  })

  it('the displayed Essai becomes the parent; none displayed → a root', async () => {
    const a = await trial('ta', 'A', NOW)
    expect(freezeDecision({ trials: [a], displayed: a, liveFp: 'fp1:moved', refs: refs(a), year: 2 })).toEqual({
      kind: 'ok',
      name: 'B',
      parentId: 'ta',
    })
    expect(freezeDecision({ trials: [a], displayed: null, liveFp: 'fp1:x', refs: refs(a), year: 2 })).toEqual({
      kind: 'ok',
      name: 'B',
      parentId: null,
    })
  })

  it('1st year: the 4th freeze hits the limit (2nd year does not)', async () => {
    const ts = [await trial('t1', 'A', NOW), await trial('t2', 'B', NOW), await trial('t3', 'C', NOW)]
    expect(YEAR1_MAX).toBe(3)
    expect(freezeDecision({ trials: ts, displayed: null, liveFp: 'fp1:x', refs: refs(ts[0]), year: 1 })).toEqual({ kind: 'limit' })
    expect(freezeDecision({ trials: ts, displayed: null, liveFp: 'fp1:x', refs: refs(ts[0]), year: 2 }).kind).toBe('ok')
    expect(freezeDecision({ trials: ts.slice(0, 2), displayed: null, liveFp: 'fp1:x', refs: refs(ts[0]), year: 1 }).kind).toBe('ok')
  })

  it('a no-op wins over the limit (nothing would be created anyway)', async () => {
    const ts = [await trial('t1', 'A', NOW), await trial('t2', 'B', NOW), await trial('t3', 'C', NOW)]
    expect(freezeDecision({ trials: ts, displayed: ts[2], liveFp: ts[2].fingerprint, refs: refs(ts[2]), year: 1 }).kind).toBe('noop')
  })
})

describe('limitCounter', () => {
  it('1st year shows "{n} essai(s) sur 3"; 2nd year shows nothing', () => {
    expect(limitCounter(1, 1)).toBe('1 essai sur 3')
    expect(limitCounter(3, 1)).toBe('3 essais sur 3')
    expect(limitCounter(3, 2)).toBeNull()
  })
})

describe('compareView', () => {
  it('lists what changed, rules fixed / broken and both predictions; no numbers', async () => {
    const a = await createTrial(
      input({
        name: 'A',
        evidence: {
          ...input().evidence,
          ruleResults: [{ ruleId: 'R4', severity: 'error', subjects: [] }],
          prediction: { text: 'je m’attends à une erreur', writtenAt: '2026-01-01T00:00:00.000Z' },
        },
      }),
      NOW,
      'ta',
    )
    const d = design()
    d.placements[0].position_m = [2, 1.2, -3]
    const b = await createTrial(
      input({
        name: 'B',
        design: d,
        parent: a,
        evidence: {
          ...input().evidence,
          ruleResults: [{ ruleId: 'R6', severity: 'warning', subjects: [] }],
          prediction: { text: 'plus d’erreur', writtenAt: '2026-01-01T00:00:00.000Z' },
        },
      }),
      NOW,
      'tb',
    )
    const v = compareView(a, b, (id) => (id === 'R4' ? 'Fantôme manquant' : id))
    expect(v.headers).toEqual(['', 'A', 'B', 'Δ'])
    expect(v.rows).toEqual([
      { label: 'Salle', a: 'salle-polyvalente', b: 'salle-polyvalente', delta: 'Identique' },
      { label: 'Placements', a: '3 appareils', b: '3 appareils', delta: 'Changé' },
      { label: 'Câblage', a: '2 câbles', b: '2 câbles', delta: 'Identique' },
      { label: 'Réglages', a: '2 réglages', b: '2 réglages', delta: 'Identique' },
    ])
    expect(v.rules).toEqual([
      { ruleId: 'R4', title: 'Fantôme manquant', verdict: 'respectée maintenant' },
      { ruleId: 'R6', title: 'R6', verdict: 'à revoir maintenant' },
    ])
    expect(v.predictionA).toBe('je m’attends à une erreur')
    expect(v.predictionB).toBe('plus d’erreur')
    expect(v.manual).toBe("Relisez votre prédiction : s'est-elle vérifiée ?")
    expect(JSON.stringify(v)).not.toMatch(/dB|\d+(,\d+)? ?ms/)
  })

  it('wiring and room changes show as Changé', async () => {
    const a = await trial('ta', 'A', NOW)
    const d = design()
    d.roomId = 'autre'
    d.rig.connections.pop()
    const b = await createTrial(input({ name: 'B', design: d }), NOW, 'tb')
    const v = compareView(a, b, (id) => id)
    expect(v.rows.find((r) => r.label === 'Salle')!.delta).toBe('Changé')
    expect(v.rows.find((r) => r.label === 'Câblage')).toEqual({ label: 'Câblage', a: '2 câbles', b: '1 câble', delta: 'Changé' })
    expect(v.rules).toEqual([])
  })
})

describe('store notices', () => {
  it('read-only reasons offer the quarantine export', () => {
    for (const w of ['quarantine-truncated', 'quarantine-failed', 'storage-unavailable', 'crypto-unavailable'] as const) {
      const n = loadNotice({ quarantined: w.startsWith('quarantine'), warnings: [w] }, 0.1)
      expect(n?.kind, w).toBe('read-only')
      expect(n?.actions, w).toContain('export-quarantine')
    }
  })

  it('a quarantine on load (still writable) says nothing is erased', () => {
    const n = loadNotice({ quarantined: true, warnings: [] }, 0.1)
    expect(n).toMatchObject({ kind: 'quarantine', title: "Données d'essais illisibles — mises de côté (quarantaine), exportables." })
    expect(n!.body).toBe("Rien n'est effacé. Votre progression n'est pas touchée.")
    expect(n!.actions).toEqual(['export-quarantine', 'dismiss'])
  })

  it('near budget → "Exporter puis archiver" with the percentage', () => {
    const n = loadNotice({ quarantined: false, warnings: ['near-budget'] }, 0.834)
    expect(n).toEqual({
      kind: 'near-budget',
      title: 'La mémoire des essais est presque pleine (83 %).',
      body: 'Exporter puis archiver les anciens essais.',
      actions: ['export-archive', 'dismiss'],
    })
  })

  it('nothing to say on a clean load', () => {
    expect(loadNotice({ quarantined: false, warnings: [] }, 0.1)).toBeNull()
  })

  it('every write failure has a message (council NN2)', () => {
    for (const r of ['quota', 'storage', 'budget', 'not-found', 'duplicate-id', 'invalid', 'empty', 'read-only'] as const) {
      const f = writeFailure(r)
      expect(f.title.length, r).toBeGreaterThan(0)
    }
    expect(writeFailure('budget').title).toBe('La mémoire des essais est pleine.')
    expect(writeFailure('quota').title).toBe("L'enregistrement dans ce navigateur a échoué. Exportez vos essais pour ne rien perdre.")
  })
})

describe('import notice', () => {
  it('counts imported, already present and rejected trials', () => {
    expect(importNotice({ imported: 2, duplicates: 0, rejected: 0 })).toBe('2 essais importés.')
    expect(importNotice({ imported: 1, duplicates: 2, rejected: 0 })).toBe('1 essai importé, 2 ignorés car déjà présents.')
    expect(importNotice({ imported: 1, duplicates: 0, rejected: 1 })).toBe('1 essai importé. 1 essai illisible ignoré.')
    expect(importNotice({ imported: 0, duplicates: 1, rejected: 2 })).toBe('0 essai importé, 1 ignoré car déjà présent. 2 essais illisibles ignorés.')
  })
})

describe('orbitView', () => {
  it('keeps the stored view inside the orbit guard (the flip lands on it exactly)', () => {
    const v = orbitView({ alpha: 1, beta: Math.PI / 2 + 0.2, radius: 0.01, target: [1, 2, 3] })
    expect(v.pose.beta).toBe(ORBIT_FEEL.upperBetaLimit)
    expect(v.pose.radius).toBeGreaterThanOrEqual(0.3)
    expect(v.pivot).toEqual([1, 2, 3])
    expect(orbitView({ alpha: 1, beta: 0.001, radius: 5, target: [0, 0, 0] }).pose.beta).toBe(ORBIT_FEEL.lowerBetaLimit)
    expect(orbitView({ alpha: 1, beta: 1, radius: 5, target: [0, 0, 0] }).pose).toEqual({ alpha: 1, beta: 1, radius: 5, target: [0, 0, 0] })
  })
})

describe('exportFileName', () => {
  it('is a dated .essai.json name', () => {
    expect(exportFileName('sandbox', new Date(2026, 9, 24, 23, 5))).toBe('essais-sandbox-2026-10-24.essai.json')
  })
})
