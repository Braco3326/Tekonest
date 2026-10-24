/**
 * Places (C3, L1): where the rig stands. A TEK Brain room template, one of the
 * three .glb venue sets, or the neutral blank room. The key is what
 * `DesignState.roomId` stores. Pure: no Babylon, no DOM.
 */
export type SetEnvId = 'plateau' | 'radio' | 'theatre'
export type PlaceRef = { kind: 'room'; id: string } | { kind: 'set'; envId: SetEnvId } | { kind: 'blank' }

export const SET_ENV_IDS: readonly SetEnvId[] = ['plateau', 'radio', 'theatre']

/** 'room:<id>' | 'set:<envId>' | 'blank'. */
export const placeKey = (p: PlaceRef): string => (p.kind === 'room' ? `room:${p.id}` : p.kind === 'set' ? `set:${p.envId}` : 'blank')

/** The place of a stored key; null or anything unknown is the blank place (never throws). */
export const placeFromKey = (key: string | null): PlaceRef => {
  if (key) {
    const room = /^room:(.+)$/.exec(key)
    if (room) return { kind: 'room', id: room[1] }
    const set = /^set:(.+)$/.exec(key)
    if (set && (SET_ENV_IDS as readonly string[]).includes(set[1])) return { kind: 'set', envId: set[1] as SetEnvId }
  }
  return { kind: 'blank' }
}
