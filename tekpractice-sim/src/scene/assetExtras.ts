/**
 * scene/assetExtras: the shape of the `extras` object the 3D pipeline writes on the root node of every GLB
 * (version 1). It carries the measured placement of the ports and controls in GLB file space, in metres,
 * pivot bottom-centre, so the app can read them back without parsing node names.
 * Types only for now; the runtime reader is added with the loader.
 */
export interface AssetExtrasV1 {
  schema: 1
  realSizeMm: { w: number; h: number; d: number }
  ports: { portId: string; pos: [number, number, number] }[]
  controls: { controlId: string; pos: [number, number, number]; axis: 'x' | 'y' | 'z'; kind: string }[]
}
