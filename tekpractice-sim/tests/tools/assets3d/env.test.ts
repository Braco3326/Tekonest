import { describe, expect, it } from 'vitest'
import { findBlender, redact, requireMeshyKey } from '../../../tools/assets3d/env'

const DEFAULT_EXE = 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe'

describe('findBlender', () => {
  it('findBlender prefers BLENDER_EXE', () => {
    const custom = 'D:/tools/blender/blender.exe'
    const found = findBlender({ env: { BLENDER_EXE: custom }, exists: () => true })
    expect(found).toBe(custom)
  })

  it('findBlender falls back to the default install path', () => {
    const found = findBlender({ env: {}, exists: (p) => p === DEFAULT_EXE })
    expect(found).toBe(DEFAULT_EXE)
  })

  it('findBlender returns null when nothing exists', () => {
    expect(findBlender({ env: { BLENDER_EXE: 'D:/nope/blender.exe' }, exists: () => false })).toBeNull()
  })
})

describe('requireMeshyKey', () => {
  it('requireMeshyKey throws when unset', () => {
    expect(() => requireMeshyKey({})).toThrow('MESHY_API_KEY is not set')
    expect(() => requireMeshyKey({ MESHY_API_KEY: '' })).toThrow('MESHY_API_KEY is not set')
  })

  it('returns the key when set', () => {
    expect(requireMeshyKey({ MESHY_API_KEY: 'msy_abc' })).toBe('msy_abc')
  })
})

describe('redact', () => {
  it('redact replaces every occurrence of the key with ***', () => {
    expect(redact('a msy_abc b msy_abc', 'msy_abc')).toBe('a *** b ***')
  })

  it('leaves text alone for an empty secret', () => {
    expect(redact('hello', '')).toBe('hello')
  })
})
