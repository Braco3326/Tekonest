/**
 * The creation viewport look (Task 14b): CREATION_TOKENS.scene turned into the
 * opt-in themes the shared scene builders take. Only the creation shell passes
 * them (sceneHost); legacy levels call RoomBuilder / DeviceSpawner without a
 * theme and keep their look. No colour literal lives here: tokens only.
 */
import type { RoomTheme } from '../scene/RoomBuilder'
import type { DeviceTheme } from '../scene/DeviceSpawner'
import { CREATION_TOKENS } from '../design/creationTokens'

const S = CREATION_TOKENS.scene
const L = CREATION_TOKENS.light

/** realWorld.category → gear family, for the placeholder's top-face tint. */
const FAMILY: Record<string, string> = {
  console: S.accentMixing,
  'monitor-controller': S.accentMixing,
  microphone: S.accentSource,
  'mic-preamp': S.accentSource,
  'powered-speaker': S.accentSpeaker,
  'studio-monitor': S.accentSpeaker,
  stagebox: S.accentInfra,
  'audio-interface': S.accentInfra,
  codec: S.accentInfra,
  'master-clock': S.accentInfra,
  patchbay: S.accentInfra,
  computer: S.accentInfra,
  cable: S.accentInfra,
}

export const CREATION_ROOM_THEME: RoomTheme = {
  floor: S.floor,
  wall: S.wall,
  ceiling: S.ceiling,
  zoneFill: S.zoneFill,
  zoneEdge: S.zoneEdge,
  roomLight: false, // sceneHost owns the calm fill + key
}

export const CREATION_DEVICE_THEME: DeviceTheme = {
  body: S.deviceBody,
  accentOf: (category) => FAMILY[category] ?? null,
  port: { in: S.portIn, out: S.portOut, bidir: S.portBidir },
  portGlow: L.portGlow,
  bodyGlow: L.bodyGlow,
  labelInk: S.labelInk,
  labelBg: S.labelBg,
  labelFont: CREATION_TOKENS.font.ui,
  shadow: S.shadow,
  shadowAlpha: L.shadowAlpha,
}
