// Resizes the original photos in assets-src/ into the web variants under public/.
//   assets-src/albums/<album>/<slug>.jpg  ->  public/albums/<album>/<slug>-{400,800}.{avif,webp}  (4:5 crop)
//   assets-src/albums/<album>/<slug>.mov  ->  public/albums/<album>/<slug>.mp4 (4:5, silent) + a poster in the formats above
//                                          (videos need ffmpeg: on PATH, or its path in the FFMPEG env var)
//   assets-src/hero/alice.jpg             ->  public/images/alice-1600.webp                      (uncropped, high quality)
// Metadata (EXIF, GPS) is stripped. Originals are gitignored; the outputs are committed.
import { execFileSync } from 'node:child_process'
import { readdir, mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'assets-src')
const out = join(root, 'public')
const IMAGE = /\.(jpe?g|png|heic|webp|tiff?)$/i
const VIDEO = /\.(mov|mp4|m4v)$/i
const FFMPEG = process.env.FFMPEG || 'ffmpeg'

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
      // AVIF must be 4:2:0 (AV1 Main profile): sharp defaults to 4:4:4 (High profile), which iPhone Safari
      // can't decode, and it shows a blank image instead of falling back to the WebP source.
      await (fmt === 'avif'
        ? img.avif({ quality: q.avif, effort: 6, chromaSubsampling: '4:2:0' })
        : img.webp({ quality: q.webp, effort: 5 })
      ).toFile(file)
      console.log('wrote', file.replace(root, ''))
    }
  }
}

/** A short clip: centre-cropped to 4:5, 800px tall, no audio, H.264 for every browser; its first frame becomes the poster. */
async function clip(input, dir, slug) {
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${slug}.mp4`)
  if (!(await newer(input, file))) return
  const crop = 'crop=min(iw\\,ih*4/5):min(ih\\,iw*5/4),scale=640:800,fps=30'
  const run = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, ...args], { stdio: 'inherit' })
  try {
    run(['-an', '-vf', crop, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', file])
  } catch (e) {
    if (e.code === 'ENOENT') return console.warn(`skipped ${slug}: install ffmpeg (or set FFMPEG) to convert videos`)
    throw e
  }
  const still = join(tmpdir(), `${slug}-poster.png`)
  run(['-frames:v', '1', '-vf', crop, still])
  await variants(still, dir, slug, 4 / 5, [400, 800], ['avif', 'webp'])
  console.log('wrote', file.replace(root, ''))
}

for (const album of await readdir(join(src, 'albums'))) {
  const dir = join(src, 'albums', album)
  if (!(await stat(dir)).isDirectory()) continue
  for (const name of await readdir(dir)) {
    if (IMAGE.test(name)) await variants(join(dir, name), join(out, 'albums', album), parse(name).name, 4 / 5, [400, 800], ['avif', 'webp'])
    else if (VIDEO.test(name)) await clip(join(dir, name), join(out, 'albums', album), parse(name).name)
  }
}

// the hero photo is the one image seen large and up close in 3D, so it gets more pixels and less compression
await variants(join(src, 'hero', 'alice.jpg'), join(out, 'images'), 'alice', null, [1600], ['webp'], { webp: 88 })
