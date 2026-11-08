// Converts the subset Fredoka TTF into three.js typeface JSON (public/fonts/fredoka.json),
// so the browser can build 3D lettering without shipping a font parser.
// Same conversion as three's TTFLoader, using the npm build of opentype.js.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const ttf = await readFile(`${root}assets-fonts/Fredoka-SemiBold-latin.ttf`)
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength))

const round = Math.round
const scale = 100000 / ((font.unitsPerEm || 2048) * 72)
const glyphs = {}
const map = font.encoding.cmap.glyphIndexMap
for (const unicode of Object.keys(map)) {
  const glyph = font.glyphs.glyphs[map[unicode]]
  const token = { ha: round(glyph.advanceWidth * scale), x_min: round(glyph.xMin * scale), x_max: round(glyph.xMax * scale), o: '' }
  for (const c of glyph.path.commands) {
    const type = c.type.toLowerCase() === 'c' ? 'b' : c.type.toLowerCase()
    token.o += type + ' '
    if (c.x !== undefined) token.o += `${round(c.x * scale)} ${round(c.y * scale)} `
    if (c.x1 !== undefined) token.o += `${round(c.x1 * scale)} ${round(c.y1 * scale)} `
    if (c.x2 !== undefined) token.o += `${round(c.x2 * scale)} ${round(c.y2 * scale)} `
  }
  glyphs[String.fromCodePoint(+unicode)] = token
}

const json = {
  glyphs,
  familyName: 'Fredoka SemiBold',
  ascender: round(font.ascender * scale),
  descender: round(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: { xMin: font.tables.head.xMin, xMax: font.tables.head.xMax, yMin: font.tables.head.yMin, yMax: font.tables.head.yMax },
  resolution: 1000,
}
await writeFile(`${root}public/fonts/fredoka.json`, JSON.stringify(json))
console.log('glyphs:', Object.keys(glyphs).length)
