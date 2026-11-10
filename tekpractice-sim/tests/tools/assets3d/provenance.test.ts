import { describe, expect, it } from 'vitest'
import { provenanceOf } from '../../../tools/assets3d/build-asset'

const base = { scripted: true, hybrid: true, meshyPicture: false, raw: false, taskId: null, referencePhotos: [] as string[] }

describe('provenanceOf: what the manifest says a hybrid is made of', () => {
  it('a hybrid whose pictures are all generic artwork (_generic_*.png) says so: not "official photo as texture", no manufacturer image', () => {
    const p = provenanceOf({ ...base, projectPhotos: ['_generic_opposite.png', '_generic_io.png'] })
    expect(p.tool).toBe('hybrid')
    expect(p.source).toBe('hybrid: own scripted geometry + generic artwork drawn by the pipeline as picture (no manufacturer image)')
    expect(p.license).toContain('internal (own work)')
    expect(p.license).toContain('generic artwork')
    expect(p.license).not.toContain('manufacturer reference photos')
    expect(p.photos).toEqual(['_generic_opposite.png', '_generic_io.png'])
    expect(p.taskId).toBeNull()
  })

  it('a hybrid with a real photo keeps the photo wording (also when one picture is generic and another is a photo)', () => {
    for (const photos of [['front.jpg', 'rear.jpg'], ['_generic_io.png', 'front.jpg']]) {
      const p = provenanceOf({ ...base, projectPhotos: photos })
      expect(p.source).toBe('hybrid: own scripted geometry + official photo as texture')
      expect(p.license).toContain('manufacturer reference photos')
    }
  })

  it('a Meshy picture keeps the Meshy wording and its task id, whatever the other pictures are', () => {
    const p = provenanceOf({ ...base, meshyPicture: true, taskId: 'task-1', referencePhotos: ['a.png'], projectPhotos: ['_generic_io.png'] })
    expect(p.source).toBe('hybrid: own scripted geometry + Meshy render and/or official photo as texture')
    expect(p.taskId).toBe('task-1')
  })

  it('a plain scripted shape is own work, an empty project list is not "generic artwork"', () => {
    expect(provenanceOf({ ...base, hybrid: false, projectPhotos: [] })).toMatchObject({ tool: 'scripted', source: 'modeled', license: 'internal (own work)' })
    expect(provenanceOf({ ...base, projectPhotos: [] }).source).toBe('hybrid: own scripted geometry + official photo as texture')
  })
})
