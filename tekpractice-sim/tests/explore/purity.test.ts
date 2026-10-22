import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ADR-0010: the input layer and the explore maths are PURE — no Babylon, no
// engine, no DOM globals at import time — so they stay unit-testable headless
// and reusable by future touch/gamepad devices.
const DIRS = ['src/input', 'src/explore']

describe('explore/input purity', () => {
  for (const dir of DIRS) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      it(`${dir}/${file} imports neither Babylon nor the engine`, () => {
        const src = readFileSync(join(dir, file), 'utf8')
        expect(src).not.toMatch(/from ['"]@babylonjs/)
        expect(src).not.toMatch(/from ['"]\.\.\/engine\//)
        expect(src).not.toMatch(/from ['"]\.\.\/logic\//)
      })
    }
  }
})
