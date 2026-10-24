/** Shared fixtures for the Essais (Trial) tests. Illustrative values only, no acoustic data. */
import type { DesignState, TrialInput } from '../../src/trials/trial'

export const design = (): DesignState => ({
  roomId: 'salle-polyvalente',
  rig: {
    instances: [
      { instanceId: 'mic-1', deviceId: 'sm58' },
      { instanceId: 'mix', deviceId: 'mixer-8' },
      { instanceId: 'spk-l', deviceId: 'powered-12' },
    ],
    connections: [
      { a: { instance: 'mic-1', port: 'out' }, b: { instance: 'mix', port: 'in-1' } },
      { a: { instance: 'mix', port: 'main-l' }, b: { instance: 'spk-l', port: 'in' } },
    ],
    controls: { 'mic-1': { phantom: false }, mix: { route: 'main' } },
  },
  placements: [
    { instanceId: 'mic-1', deviceId: 'sm58', position_m: [0, 1.2, -3], yawDeg: 0 },
    { instanceId: 'spk-l', deviceId: 'powered-12', position_m: [-4, 2.2, -9], yawDeg: 10 },
  ],
})

export const input = (over: Partial<TrialInput> = {}): TrialInput => ({
  name: 'Essai A',
  design: design(),
  consumed: { room: { roomId: 'salle-polyvalente', geometryRev: null } },
  view: { pose: { alpha: 1.5, beta: 1, radius: 12, target: [0, 1, 0] }, pivot: [0, 1, 0] },
  evidence: {
    prediction: { text: 'Le micro arrive sur la tranche 1.', writtenAt: '2026-10-24T10:00:00.000Z' },
    ruleResults: [],
    levelState: null,
    rulesRev: 'r1:abc',
    note: 'Premier montage.',
  },
  parent: null,
  ...over,
})

export const NOW = '2026-10-24T10:05:00.000Z'
