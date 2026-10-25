/**
 * View cube face labels (Task 17, C11, own work): « FACE », « ARRIÈRE », … painted
 * on a transparent DynamicTexture per face, Papier on a Nuit halo, with a thin edge
 * line so the cube's edges read without an edges renderer (no extra pass).
 *
 * Drawn with the 2D context directly, never `DynamicTexture.drawText`: that one
 * parses the font size out of the font string and a numeric weight (`600 44px`)
 * breaks it (Task 14b). The label font is set by `CUBE_LABEL_FONT` below
 * (accent check on the « È » of ARRIÈRE, see the Task 17 report).
 */
import { DynamicTexture, type Scene } from '@babylonjs/core'
import { CREATION_TOKENS } from '../design/creationTokens'
import { COPY } from './copy'

const K = CREATION_TOKENS.cube
/** Texture side (px). The face shows at ~60–70 px: mipmapped, so it minifies cleanly. */
const TEX = 256

export type CubeFace = 'face' | 'arriere' | 'gauche' | 'droite' | 'dessus' | 'dessous'

/**
 * Label font: IBM Plex Sans 600, not Tektur. At the cube's size Tektur draws the
 * grave accent of « ARRIÈRE » as a flat bar (it reads « ARRĒRE »), the same
 * defect that moved the panel titles (« PROPRIÉTÉS ») to IBM Plex Sans (Task 17
 * screenshot check: docs/creative/screens/task-17-font-tektur-arriere-x3.png
 * vs task-17-font-plex-arriere-x3.png).
 */
export const CUBE_LABEL_FONT = { weight: 600, family: CREATION_TOKENS.font.ui }

/** The six labels (copy deck `cube.*`, uppercase). */
export function cubeLabel(face: CubeFace): string {
  return COPY.cube![face]!
}

/**
 * Paint one face decal on a TRANSPARENT texture: the edge line on the border and
 * the label (Papier ink on a Nuit halo), centred and fitted. The body colour is
 * the box underneath (shaded per face) and the hover patch sits between the two,
 * so the label always reads on top of it.
 */
export function drawCubeFace(ctx: CanvasRenderingContext2D, size: number, text: string): void {
  ctx.clearRect(0, 0, size, size)
  // Edge line: 1.5 px or so on screen, on the face border (two faces meet = one edge).
  const line = Math.round(size * 0.035)
  ctx.strokeStyle = K.edge
  ctx.lineWidth = line
  ctx.strokeRect(line / 2, line / 2, size - line, size - line)
  const { weight, family } = CUBE_LABEL_FONT
  let px = Math.round(size * 0.24)
  ctx.font = `${weight} ${px}px ${family}`
  const max = size * 0.8
  const w = ctx.measureText?.(text)?.width ?? 0
  if (w > max) {
    px = Math.max(12, Math.floor((px * max) / w))
    ctx.font = `${weight} ${px}px ${family}`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Capitals sit visually centred a little below the em box's middle.
  const y = size / 2 + px * 0.04
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(4, Math.round(px * 0.22))
  ctx.strokeStyle = K.halo
  ctx.strokeText(text, size / 2, y)
  ctx.fillStyle = K.label
  ctx.fillText(text, size / 2, y)
}

export interface CubeFaceTexture {
  texture: DynamicTexture
  /** Paint again (the web font arrived after the first paint). */
  redraw(): void
}

export function cubeFaceTexture(scene: Scene, face: CubeFace): CubeFaceTexture {
  const texture = new DynamicTexture(`tex:cube:${face}`, { width: TEX, height: TEX }, scene, true)
  texture.anisotropicFilteringLevel = 4
  texture.hasAlpha = true
  const redraw = (): void => {
    drawCubeFace(texture.getContext() as unknown as CanvasRenderingContext2D, TEX, cubeLabel(face))
    texture.update(true)
  }
  redraw()
  return { texture, redraw }
}

/**
 * Calls `fn` once the label font can be drawn (a canvas never waits for a web
 * font: the first paint may use the fallback). No-op where there is no FontFaceSet.
 */
export function whenLabelFontReady(fn: () => void): void {
  const fonts = (globalThis as { document?: { fonts?: FontFaceSet } }).document?.fonts
  if (!fonts?.load) return
  const { weight, family } = CUBE_LABEL_FONT
  fonts.load(`${weight} 40px ${family}`, 'ARRIÈRE').then(
    () => fn(),
    () => {}
  )
}
