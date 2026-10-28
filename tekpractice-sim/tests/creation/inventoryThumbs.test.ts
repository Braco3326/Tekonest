import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { THUMB_IDS, thumbPath } from '../../src/creation/inventoryThumbs'

const dir = fileURLToPath(new URL('../../public/assets/thumbs/', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.png'))
const deviceIds = new Set((catalogJson as { devices: { id: string }[] }).devices.map((d) => d.id))

describe('inventory thumbnails (final review 4): the id -> file mapping of the legacy shelf, public/assets/thumbs/<id>.png', () => {
  it('there are thumbnails on disk (the 50 of the legacy shelf)', () => {
    expect(files.length).toBeGreaterThanOrEqual(50)
  })
  it('THUMB_IDS is exactly the catalog devices that have a file (no drift in either direction)', () => {
    const onDisk = files.map((f) => f.replace(/\.png$/, '')).filter((id) => deviceIds.has(id)).sort()
    expect([...THUMB_IDS].sort()).toEqual(onDisk)
    expect(onDisk.length).toBeGreaterThan(15)
  })
  it('thumbPath is the shelf path for a device that has one, and null for one that has none', () => {
    expect(thumbPath('yamaha-ql1')).toBe('assets/thumbs/yamaha-ql1.png')
    expect(thumbPath('multiprise-secteur')).toBeNull()
    expect(thumbPath('not-a-device')).toBeNull()
  })
})
