// Writes the public TekPractice privacy page (src/accounts/privacyPolicy.ts -> tools/privacyPage.ts) as a static file:
//   <outRoot>/tekpractice/confidentialite/index.html   (default outRoot: dist-site-pages/)
// The tree under outRoot mirrors the umbrella site's root (website-prototype/), so the deploy copies dist-site-pages/tekpractice/confidentialite
// to website-prototype/tekpractice/confidentialite, next to tekpractice/jouer (dist-site). Served at https://tekonest.com/tekpractice/confidentialite/.
// Run by tools/build-site.mjs (npm run build:site), so a deploy build always carries the page. Usage: tsx tools/build-privacy-page.ts [outRoot]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPrivacyPage } from './privacyPage'
import { PRIVACY_PAGE_PATH } from '../src/accounts/privacyPolicy'

export const PRIVACY_PAGES_DIR = 'dist-site-pages'

/** The file's path under outRoot, from the page's public path (/tekpractice/confidentialite/ -> tekpractice/confidentialite/index.html). */
export function privacyPageFile(outRoot: string): string {
  return join(outRoot, ...PRIVACY_PAGE_PATH.split('/').filter(Boolean), 'index.html')
}

export function writePrivacyPage(outRoot: string): string {
  const file = privacyPageFile(outRoot)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, renderPrivacyPage(), 'utf8')
  return file
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const outRoot = resolve(root, process.argv[2] ?? PRIVACY_PAGES_DIR)
  console.log('[privacy-page] wrote ' + writePrivacyPage(outRoot))
}
