/**
 * Asset URLs that survive a sub-path deploy (Vite `base`, e.g. /tekpractice/jouer/).
 * A hard-coded "/assets/x.glb" would hit the site root and 404 there.
 */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base : `${base}/`
  return b + path.replace(/^\/+/, '')
}
