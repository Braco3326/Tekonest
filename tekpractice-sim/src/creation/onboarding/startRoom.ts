/**
 * Which room the start screen (and Aide « Premiers pas » with no place open) opens (onboarding packs, plan T6.3, spec 7.1 / 7.2 and 8.5). The package's
 * `layout.start` FIELD decides, never its number: `neutral-room` opens « Salle vide » (the `blank` card, today's path); `playable-model` opens the template
 * `premier-son-pret` (a bench already wired and powered, content/templates/premier-son-pret.json) through the picker's own template path (card key
 * `template:<id>`, the same `pick` as a click on the template card), so the opening is announced, undoable and autosaved exactly as that card's.
 *
 * Pure: no DOM, no Babylon. A template is data: if it is not among the picker's cards (a template whose place is unknown is left out, boot.ts), the neutral
 * room opens instead; the learner is never left without a room.
 */
import type { LayoutPreset } from '../../design/packages'

/** The id of the template the playable-model start opens (content/templates). */
export const PLAYABLE_MODEL_TEMPLATE = 'premier-son-pret'

/** The picker card key of the room `start` opens; `has` says which card keys exist (place cards and template cards). */
export function startRoomKey(start: LayoutPreset['start'], has: (key: string) => boolean): string {
  const model = `template:${PLAYABLE_MODEL_TEMPLATE}`
  return start === 'playable-model' && has(model) ? model : 'blank'
}
