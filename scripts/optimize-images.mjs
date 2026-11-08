// Resizes the original photos in assets-src/ into the web variants under public/.
//   assets-src/albums/<album>/<slug>.jpg  ->  public/albums/<album>/<slug>-{400,800}.{avif,webp}  (4:5 crop)
//   assets-src/hero/alice.jpg             ->  public/images/alice-1600.webp                      (uncropped, high quality)
// Metadata (EXIF, GPS) is stripped. Originals are gitignored; the outputs are committed.
import { readdir, mkdir, stat } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'assets-src')
const out = join(root, 'public')
const IMAGE = /\.(jpe?g|png|heic|webp|tiff?)$/i

/** Horizontal focal point (0 = left, 1 = right) for photos where the automatic crop misses the subject. */
const FOCUS_X = {
  'barbell-meet': 0.48,
}

async function newer(input, output) {
  try {
    return (await stat(input)).mtimeMs > (await stat(output)).mtimeMs
  } catch {
    return true
  }
}

async function variants(input, dir, slug, ratio, widths, formats, q = { avif: 52, webp: 78 }) {
  await mkdir(dir, { recursive: true })
  const meta = await sharp(input).rotate().metadata()
  const fx = FOCUS_X[slug]
  for (const w of widths) {
    // ratio null keeps the photo's own proportions
    const h = ratio ? Math.round(w / ratio) : undefined
    for (const fmt of formats) {
      const file = join(dir, `${slug}-${w}.${fmt}`)
      if (!(await newer(input, file))) continue
      let img = sharp(input).rotate()
      if (fx !== undefined && ratio) {
        // crop a full-height window centred on the focal point, then scale
        const W = meta.autoOrient?.width ?? meta.width, H = meta.autoOrient?.height ?? meta.height
        const cw = Math.min(W, Math.round(H * ratio))
        const left = Math.max(0, Math.min(W - cw, Math.round(fx * W - cw / 2)))
        img = img.extract({ left, top: 0, width: cw, height: H }).resize(w, h)
      } else img = img.resize(w, h, { fit: 'cover', position: sharp.strategy.attention })
      await (fmt === 'avif' ? img.avif({ quality: q.avif, effort: 6 }) : img.webp({ quality: q.webp, effort: 5 })).toFile(file)
      console.log('wrote', file.replace(root, ''))
    }
  }
}

for (const album of await readdir(join(src, 'albums'))) {
  const dir = join(src, 'albums', album)
  if (!(await stat(dir)).isDirectory()) continue
  for (const name of await readdir(dir)) {
    if (!IMAGE.test(name)) continue
    await variants(join(dir, name), join(out, 'albums', album), parse(name).name, 4 / 5, [400, 800], ['avif', 'webp'])
  }
}

// the hero photo is the one image seen large and up close in 3D, so it gets more pixels and less compression
await variants(join(src, 'hero', 'alice.jpg'), join(out, 'images'), 'alice', null, [1600], ['webp'], { webp: 88 })
