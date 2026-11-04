/**
 * Minimal typing for draco3dgltf (the package ships none). Only what the assets3d tools use: the encoder and
 * decoder module factories, passed to @gltf-transform's NodeIO as the draco3d.* dependencies.
 */
declare module 'draco3dgltf' {
  const draco3d: {
    createEncoderModule: () => Promise<unknown>
    createDecoderModule: () => Promise<unknown>
  }
  export default draco3d
}
