import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isMainModule as fromBuild } from '../../../tools/assets3d/build-asset'
import { isMainModule } from '../../../tools/assets3d/mainModule'

const TOOLS = join(__dirname, '..', '..', '..', 'tools')

describe('mainModule.isMainModule', () => {
  const url = 'file:///E:/dev/repo/tools/assets3d/meshy-balance.ts'

  it('is the very function build-asset re-exports', () => {
    expect(fromBuild).toBe(isMainModule)
  })

  it('ignores a drive-letter case mismatch on win32 (the old simple guard silently did nothing there)', () => {
    expect(isMainModule('e:\\dev\\repo\\tools\\assets3d\\meshy-balance.ts', url, 'win32')).toBe(true)
    expect(isMainModule('E:/dev/repo/tools/assets3d/other.ts', url, 'win32')).toBe(false)
  })

  it('every CLI script uses the shared guard, not its own copy', () => {
    for (const file of ['validate-assets.ts', 'assets3d/build-asset.ts', 'assets3d/meshy-balance.ts', 'assets3d/spec-skeleton.ts']) {
      const src = readFileSync(join(TOOLS, file), 'utf8')
      expect(src, file).toMatch(/isMainModule\(process\.argv\[1\], import\.meta\.url\)/)
      expect(src, file).not.toMatch(/function isMainModule/)
      expect(src, file).not.toMatch(/resolve\(process\.argv\[1\]\) ===/)
    }
  })

  it('the shared module stays light (no sharp, gltf-transform or Blender imports)', () => {
    const src = readFileSync(join(TOOLS, 'assets3d', 'mainModule.ts'), 'utf8')
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports.sort()).toEqual(['node:path', 'node:url'])
  })
})
