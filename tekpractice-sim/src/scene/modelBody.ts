/**
 * Night wave 1, item 8. A shipped .glb may include something the device is not: the Genelec 8030C file is ONE mesh with its floor stand (a base
 * plate and a thin neck). The height normalisation scales the model so that its measured height equals the device's real height; with the stand
 * counted, the cabinet came out at about 75 % of its real size (0.299 m x 0.715 / 0.285 m). A catalog device can declare `modelBody.baseFraction`: the share of the model's total
 * height that is stand, under the cabinet (measured on the file, see tests/assets/modelBody.test.ts). Mode Création then scales so that the
 * CABINET (the model minus that share) has the real height. Pure arithmetic, no Babylon.
 */

/** The cabinet's height: the model's total height minus the stand's share. A missing, non-finite or out-of-range share means « no stand ». */
export function bodyHeightOf(totalHeight: number, baseFraction: number | undefined): number {
  if (baseFraction === undefined || !Number.isFinite(baseFraction) || baseFraction <= 0 || baseFraction >= 1) return totalHeight
  return totalHeight * (1 - baseFraction)
}

/** The uniform scale that makes the cabinet `realHeight` metres tall; 1 for a model with no usable height. */
export function scaleForHeight(realHeight: number, totalHeight: number, baseFraction: number | undefined): number {
  const body = bodyHeightOf(totalHeight, baseFraction)
  return body > 1e-6 ? realHeight / body : 1
}
