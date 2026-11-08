// Resizes the original photos in assets-src/ into the web variants under public/.
//   assets-src/albums/<album>/<slug>.jpg  ->  public/albums/<album>/<slug>-{400,800}.{avif,webp}  (4:5 crop)
//   assets-src/hero/alice.jpg             ->  public/images/alice-{400,800}.webp                 (2:3 crop)
// Metadata (EXIF, GPS) is stripped. Originals are gitignored; the outputs are committed.
import { readdir, mkdir, stat } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'assets-src')
const out = join(root, 'public')
const IMAGE = /\.(jpe?g|png|heic|webp|tiff?)$/i

async function newer(input, output) {
  try {
    return (await stat(input)).mtimeMs > (await stat(output)).mtimeMs
  } catch {
    return true
  }
}

async function variants(input, dir, slug, ratio, widths, formats) {
  await mkdir(dir, { recursive: true })
  for (const w of widths) {
    const h = Math.round(w / ratio)
    for (const fmt of formats) {
      const file = join(dir, `${slug}-${w}.${fmt}`)
      if (!(await newer(input, file))) continue
      const img = sharp(input).rotate().resize(w, h, { fit: 'cover', position: sharp.strategy.attention })
      await (fmt === 'avif' ? img.avif({ quality: 52, effort: 6 }) : img.webp({ quality: 78, effort: 5 })).toFile(file)
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

await variants(join(src, 'hero', 'alice.jpg'), join(out, 'images'), 'alice', 2 / 3, [400, 800], ['webp'])
