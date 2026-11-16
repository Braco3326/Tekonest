import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
const dir = process.argv[2], outDir = process.argv[3]
const ids = JSON.parse(readFileSync(process.argv[4], 'utf8'))
mkdirSync(outDir, { recursive: true })
const cw = 300, ch = 232, cols = 3, rows = 6, per = cols * rows
for (let s = 0; s * per < ids.length; s++) {
  const chunk = ids.slice(s * per, (s + 1) * per)
  const comps = []
  for (let i = 0; i < chunk.length; i++) {
    const id = chunk[i], f = `${dir}/${id}.png`
    const front = await sharp(f).extract({ left: 0, top: 0, width: 620, height: 480 }).resize(cw, ch, { fit: 'contain', background: '#999' }).toBuffer()
    const meta = await sharp(f).metadata()
    const hasPhoto = meta.width >= 620 * 3
    const photo = hasPhoto ? await sharp(f).extract({ left: 1240, top: 0, width: 620, height: 480 }).resize(cw, ch, { fit: 'contain', background: '#eee' }).toBuffer() : await sharp({ create: { width: cw, height: ch, channels: 3, background: '#ddd' } }).png().toBuffer()
    const x = (i % cols) * cw * 2, y = Math.floor(i / cols) * (ch + 14)
    comps.push({ input: front, left: x, top: y }, { input: photo, left: x + cw, top: y })
    comps.push({ input: Buffer.from(`<svg width="${cw*2}" height="14"><rect width="100%" height="14" fill="#222"/><text x="4" y="11" font-size="11" fill="#fff" font-family="Arial">${s*per+i+1}. ${id}</text></svg>`), left: x, top: y + ch })
  }
  await sharp({ create: { width: cw * 2 * cols, height: rows * (ch + 14), channels: 3, background: '#222' } }).composite(comps).png().toFile(`${outDir}/sheet-${String(s + 1).padStart(2, '0')}.png`)
}
console.log('sheets', Math.ceil(ids.length / per))
