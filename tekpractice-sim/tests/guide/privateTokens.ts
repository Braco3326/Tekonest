// Private tokens, hashed. A file is cut into lower-case alphanumeric tokens; a token, or two adjacent tokens joined, whose salted SHA-256 is in a list is a hit.
// Nothing here can be read back into a word.
import { createHash } from 'node:crypto'

const SALT = 'tp-guide-public-scan-v1'

const NAMES = [
  'e22bb181714d480ab0c9fc924553a68d24f44675e9ab2cf71ce84640a66e83d3',
  '3b4aff9a182667cb6bbea135823c4992b027331eb7221658306e23f12213c9a9',
  'c2c554757bbe6dda0ab115eda2a41bf51b9809561f6ee1ed360e26e70c7a5423',
  '2da76a6c92ffff25bd984373f88f15aa3a303a87edd67b5612c9e20f696af774',
  'b341072d362d979364ef7af2f37ce16952679817a811c4c074040f702d64ad66',
  'a8097b6c291ffef4440ec8a698dc03e983c17bb5d0f458ef6b4abb23d2ac91cf',
  '9423c163d62125f2877450a7b4aa528f7bb780f8e5a3f2ae411b2d2863201b97',
  '8c29153013482f6a63c0206b446027076f035f9d4b4def3cebef4d3bee10b59e',
  '7bb851c7975eb15a803f6cd79f5784ddc518a8904309a7d377dc6fc90d70b7e4',
]
const ROLES = ['005dcacd3ecd3bb12f8919c784fb0784769754e54d1863fbf2b9025d989003ec', 'c42b3bb8cad804b9590f40c71778e8096244c299591149fd48bd2a3c111b4221']

export const hashToken = (token: string, salt: string = SALT): string => createHash('sha256').update(salt + token).digest('hex')

/** Lower-case alphanumeric tokens of a text. */
export function tokensOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** A scanner for a list of hashes: the hits of a text (each token, then each adjacent pair joined), as hashes so that a failure message names nothing. */
export function makeScanner(hashes: readonly string[], salt: string = SALT): (text: string) => string[] {
  const set = new Set(hashes)
  return (text) => {
    const tokens = tokensOf(text)
    const hits: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      for (const candidate of [tokens[i], i + 1 < tokens.length ? tokens[i] + tokens[i + 1] : '']) {
        if (candidate === '') continue
        const h = hashToken(candidate, salt)
        if (set.has(h)) hits.push(h.slice(0, 8))
      }
    }
    return hits
  }
}

/** The private names: a hit anywhere in the public guide files. */
export const privateHits = makeScanner(NAMES)
/** The role words: a hit only where the vendored badge pattern is not. */
export const roleHits = makeScanner(ROLES)
