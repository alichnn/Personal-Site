import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  SRGBColorSpace,
  Shape,
  Vector2,
  type ColorRepresentation,
} from 'three'
import { addOutline, outlineAll, toon } from '../core/toon'
import { blob, flat, merge, noise3, paint, rng, range } from '../core/util'

// Low-poly, toon-shaded props built in code: one consistent style, no asset downloads, and
// procedural animation hooks (each builder returns its moving parts).

const vc = (opts: Parameters<typeof toon>[1] = {}) => toon('#ffffff', { vertexColors: true, ...opts })

/** Paint faces by a rule on their centroid. */
function paintBy(geo: BufferGeometry, pick: (x: number, y: number, z: number) => ColorRepresentation) {
  const g = flat(geo)
  const p = g.getAttribute('position') as BufferAttribute
  const col = new Float32Array(p.count * 3)
  const c = new Color()
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
    c.set(pick(x, y, z))
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3)
  }
  g.setAttribute('color', new BufferAttribute(col, 3))
  return g
}

// ---------------------------------------------------------------- sunflower

export function makeSunflower(seed: number) {
  const r = rng(seed)
  const H = range(r, 1.5, 2.3)
  const root = new Group()
  const stem = paint(flat(new CylinderGeometry(0.035, 0.055, H, 5)).translate(0, H / 2, 0), '#4f8a2c')
  const leaves = [0.35, 0.6].map((h, i) => {
    const g = flat(blob(0.22, 0, 0.1, seed + i, [1.6, 0.18, 0.8]))
    g.rotateZ(i ? 0.5 : -0.5)
    g.translate(i ? -0.22 : 0.22, H * h, 0)
    return paint(g, '#5c9a33')
  })
  const body = new Mesh(merge([stem, ...leaves]), vc({ rim: 0.5 }))
  body.castShadow = true
  root.add(body)

  const head = new Group()
  head.position.y = H
  const parts: BufferGeometry[] = []
  parts.push(paint(flat(new CylinderGeometry(0.27, 0.3, 0.1, 10)).rotateX(Math.PI / 2), '#5b3816', 0.25, r))
  parts.push(paint(flat(new CylinderGeometry(0.2, 0.2, 0.06, 8)).rotateX(Math.PI / 2).translate(0, 0, 0.05), '#3c240e'))
  const n = 15
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const petal = flat(new ConeGeometry(0.085, 0.36, 4)).scale(1, 1, 0.35)
    petal.translate(0, 0.42, 0).rotateZ(a).translate(0, 0, 0.01 * (i % 2))
    parts.push(paint(petal, i % 2 ? '#f7c51e' : '#f3ad13'))
  }
  const face = new Mesh(merge(parts), vc({ rim: 0.7 }))
  face.castShadow = true
  head.add(face)
  head.rotation.x = 0.3
  root.add(head)
  return { root, head, height: H }
}

// ---------------------------------------------------------------- signpost

export interface SignArrow {
  label: string
  /** Which way the arrow points, seen from the front. */
  dir: 'left' | 'right'
}

/**
 * A storybook signpost: a rough-hewn post with a peaked cap, bevelled swallow-tail arrow planks
 * with painted wood grain and carved lettering, nail heads, and moss and stones at its foot.
 * The grain and lettering are painted into each plank's texture, so they stay crisp and cost
 * nothing extra to draw.
 */
export async function makeSignpost(arrows: SignArrow[], font = '"Redaction 50", Georgia, serif') {
  await document.fonts?.load(`700 64px ${font}`).catch(() => {})
  const root = new Group()
  const r = rng(5)
  const H = 2.9

  // post: seven-sided, slightly tapered and leaning, with a peaked cap
  const post = paint(flat(new CylinderGeometry(0.105, 0.13, H, 7)).translate(0, H / 2, 0), '#7a4f2e', 0.18, r)
  const cap = paint(flat(new ConeGeometry(0.15, 0.2, 7)).translate(0, H + 0.1, 0), '#6a4226', 0.1, r)
  const collar = paint(flat(new CylinderGeometry(0.15, 0.15, 0.06, 7)).translate(0, H - 0.02, 0), '#5b381f', 0.1, r)
  const postMesh = new Mesh(merge([post, cap, collar]), vc({ rim: 0.5 }))
  postMesh.rotation.z = 0.025
  root.add(postMesh)

  const nail = toon('#4a4440', { rim: 0.9 })
  const tip = 0.3, tail = 0.12
  let top = 2.72
  arrows.forEach((a, i) => {
    // long labels go on two lines on a taller plank, so the sign stays compact
    const lines = a.label.length > 11 ? a.label.split(' ') : [a.label]
    const tall = lines.length > 1 ? 0.62 : 0.44
    const len = 1.2 + Math.max(...lines.map((l) => l.length)) * 0.075
    const s = a.dir === 'right' ? 1 : -1
    // swallow-tail plank pointing +x, mirrored for left
    const pts: [number, number][] = [[-0.3, -tall / 2], [len, -tall / 2], [len + tip, 0], [len, tall / 2], [-0.3, tall / 2], [-0.3 + tail, 0]]
    const shape = new Shape(pts.map(([x, y]) => new Vector2(x * s, y)))
    const geo = new ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 1 })
    geo.translate(0, 0, -0.04)
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    // planar UVs across the face, so the painted plank lines up with the geometry
    const pos = geo.getAttribute('position') as BufferAttribute
    const uv = new Float32Array(pos.count * 2)
    const bw = bb.max.x - bb.min.x, bh = bb.max.y - bb.min.y
    for (let k = 0; k < pos.count; k++) {
      uv[k * 2] = (pos.getX(k) - bb.min.x) / bw
      uv[k * 2 + 1] = (pos.getY(k) - bb.min.y) / bh
    }
    geo.setAttribute('uv', new BufferAttribute(uv, 2))
    const tex = paintPlank(lines, pts.map(([x, y]) => [x * s, y]), bb.min.x, bb.max.y, bw, bh, font, i ? '#c9935a' : '#dba86c', 11 + i)
    const board = new Mesh(geo, toon('#ffffff', { map: tex, rim: 0.45 }))
    board.position.set(0, top - tall / 2, 0.17)
    top -= tall + 0.07
    board.rotation.set(0, s * (i ? -0.12 : 0.1), (i ? -0.03 : 0.025) * s)
    root.add(board)
    // nail heads where the plank meets the post
    for (const ny of [-0.1, 0.1]) {
      const n = new Mesh(flat(new DodecahedronGeometry(0.03, 0)), nail)
      n.position.set(0, ny, 0.075)
      n.userData.noOutline = true
      board.add(n)
    }
  })

  // moss, tufts and stones at the foot
  const foot: BufferGeometry[] = []
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r() * 0.6, d = range(r, 0.12, 0.3)
    const g = flat(blob(range(r, 0.09, 0.16), 0, 0.3, 30 + k, [1.3, 0.55, 1.2])).translate(Math.cos(a) * d, 0.03, Math.sin(a) * d)
    foot.push(paint(g, k % 3 ? '#4f8a2c' : '#6aa53a', 0.12, r))
  }
  for (const [x, z, rad] of [[0.38, 0.12, 0.11], [-0.3, 0.22, 0.08]] as const) {
    foot.push(paint(flat(new DodecahedronGeometry(rad, 0)).scale(1.3, 0.7, 1).translate(x, rad * 0.4, z), '#9a958a', 0.1, r))
  }
  const footMesh = new Mesh(merge(foot), vc({ rim: 0.6 }))
  footMesh.userData.noOutline = true
  root.add(footMesh)

  root.traverse((o: any) => o.isMesh && (o.castShadow = true))
  outlineAll(root, 0.022, '#2b1a10')
  return { root }
}

/** Long, wavy wood-grain strokes running along x across a w×h area of the canvas. */
export function paintGrain(ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number, lines = 16) {
  for (let k = 0; k < lines; k++) {
    const y0 = r() * h, amp = 2 + r() * 5, f = 0.004 + r() * 0.006, ph = r() * 9
    ctx.beginPath()
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7) * amp * 0.4)
    ctx.strokeStyle = `rgba(92, 52, 22, ${0.12 + r() * 0.18})`
    ctx.lineWidth = 1.5 + r() * 3.5
    ctx.stroke()
  }
}

/** Paints one arrow plank: base colour, wavy grain, a knot, darker worn edges, and carved lettering. */
function paintPlank(lines: string[], pts: [number, number][], minX: number, maxY: number, bw: number, bh: number, font: string, base: string, seed: number) {
  const r = rng(seed)
  const W = 1024, Hc = Math.round((W * bh) / bw)
  const c = document.createElement('canvas')
  c.width = W
  c.height = Hc
  const ctx = c.getContext('2d')!
  const toPx = ([x, y]: [number, number]) => [((x - minX) / bw) * W, ((maxY - y) / bh) * Hc] as const
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, Hc)
  paintGrain(ctx, W, Hc, r)
  // a knot
  const kx = W * (0.15 + r() * 0.15), ky = Hc * (0.25 + r() * 0.5)
  for (let k = 3; k > 0; k--) {
    ctx.beginPath()
    ctx.ellipse(kx, ky, 7 * k + 4, 3.5 * k + 2, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(92, 52, 22, ${0.18 + 0.1 * k})`
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
  // worn, darker edges (also what the bevelled sides pick up)
  ctx.beginPath()
  pts.forEach((p, k) => (k ? ctx.lineTo(...toPx(p)) : ctx.moveTo(...toPx(p))))
  ctx.closePath()
  ctx.strokeStyle = 'rgba(80, 44, 18, 0.55)'
  ctx.lineWidth = Hc * 0.1
  ctx.stroke()
  // carved lettering, centred on the body of the plank (not the tip or tail)
  const xs = pts.map((p) => toPx(p)[0])
  const left = Math.min(...xs), right = Math.max(...xs)
  // the plank's body: clear of the arrow tip at one end and of the post and its nails (world x = 0) at the other
  const pointsRight = pts[0]![0] < pts[1]![0]
  const post = toPx([0, 0])[0], clear = (0.13 / bw) * W
  const bodyL = pointsRight ? post + clear : left + (right - left) * 0.2
  const bodyR = pointsRight ? right - (right - left) * 0.2 : post - clear
  let size = Hc * (lines.length > 1 ? 0.36 : 0.52)
  ctx.font = `700 ${size}px ${font}`
  const maxW = (bodyR - bodyL) * 0.9
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
  if (w > maxW) {
    size *= maxW / w
    ctx.font = `700 ${size}px ${font}`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = (bodyL + bodyR) / 2, lineH = size * 1.05
  lines.forEach((line, k) => {
    const cy = Hc / 2 + size * 0.04 + (k - (lines.length - 1) / 2) * lineH
    ctx.fillStyle = 'rgba(255, 236, 200, 0.55)'
    ctx.fillText(line, cx, cy + size * 0.05)
    ctx.fillStyle = '#3a2210'
    ctx.fillText(line, cx, cy)
  })
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// ---------------------------------------------------------------- bird

export function makeBird() {
  const root = new Group()
  const body = new Group()
  root.add(body)
  const blue = '#3f74cf', belly = '#f0894a', dark = '#1d2433'
  const torso = new Mesh(
    paintBy(new IcosahedronGeometry(0.5, 1).scale(0.62, 0.55, 0.85), (_x, y, z) => (y < 0.02 && z > -0.25 ? belly : blue)),
    vc({ rim: 1 }),
  )
  body.add(torso)
  const head = new Group()
  head.position.set(0, 0.3, 0.36)
  const skull = new Mesh(paintBy(new IcosahedronGeometry(0.27, 1), (_x, y, z) => (y < -0.06 && z > 0 ? belly : blue)), vc({ rim: 1 }))
  const beak = new Mesh(paint(flat(new ConeGeometry(0.06, 0.2, 4)).rotateX(Math.PI / 2).translate(0, -0.02, 0.32), '#f2b431'), vc())
  head.add(skull, beak)
  for (const s of [-1, 1]) {
    const eye = new Mesh(paint(flat(new IcosahedronGeometry(0.045, 0)), dark), vc({ rim: 0 }))
    eye.position.set(s * 0.19, 0.06, 0.14)
    eye.userData.noOutline = true
    head.add(eye)
  }
  body.add(head)
  const tail = new Group()
  tail.position.set(0, 0.06, -0.38)
  const feathers = new Mesh(paint(flat(new ConeGeometry(0.17, 0.55, 4)).rotateX(-Math.PI / 2).scale(1, 0.3, 1).translate(0, 0, -0.25), '#2f5aa8'), vc())
  tail.add(feathers)
  tail.rotation.x = -0.35
  body.add(tail)
  const wings: Group[] = []
  for (const s of [-1, 1]) {
    const wing = new Group()
    wing.position.set(s * 0.26, 0.12, 0.02)
    const g = flat(new BoxGeometry(0.72, 0.04, 0.38, 2, 1, 1))
    const pos = g.getAttribute('position') as BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      // taper toward the tip and sweep back
      const x = pos.getX(i) + 0.36
      pos.setZ(i, pos.getZ(i) * (1 - x * 0.7) - x * 0.25)
      pos.setX(i, x * s)
    }
    g.computeVertexNormals()
    wing.add(new Mesh(paint(g, '#355fb0'), vc()))
    wings.push(wing)
    body.add(wing)
  }
  for (const s of [-1, 1]) {
    const leg = new Mesh(paint(flat(new CylinderGeometry(0.02, 0.02, 0.26, 4)).translate(0, -0.13, 0), '#c78a3a'), vc({ rim: 0 }))
    leg.position.set(s * 0.1, -0.22, 0.05)
    leg.userData.noOutline = true
    body.add(leg)
  }
  outlineAll(body, 0.02, '#151a26')
  return { root, body, head, tail, wings }
}

// ---------------------------------------------------------------- squirrel

export function makeSquirrel() {
  const root = new Group()
  const fur = '#b8682e', cream = '#f2d4a8', dark = '#1e140d'
  const body = new Group()
  root.add(body)
  const torso = new Mesh(
    paintBy(new IcosahedronGeometry(0.5, 1).scale(0.68, 0.95, 0.68).translate(0, 0.45, 0), (_x, _y, z) => (z > 0.18 ? cream : fur)),
    vc({ rim: 1 }),
  )
  body.add(torso)
  const head = new Group()
  head.position.set(0, 0.98, 0.1)
  const skull = new Mesh(paintBy(new IcosahedronGeometry(0.28, 1).scale(1, 0.95, 1.05), (_x, y, z) => (z > 0.18 && y < 0 ? cream : fur)), vc({ rim: 1 }))
  head.add(skull)
  for (const s of [-1, 1]) {
    const ear = new Mesh(paint(flat(new ConeGeometry(0.08, 0.2, 4)).translate(0, 0.1, 0), fur), vc())
    ear.position.set(s * 0.14, 0.2, -0.02)
    ear.rotation.z = -s * 0.25
    head.add(ear)
    const eye = new Mesh(paint(flat(new IcosahedronGeometry(0.045, 0)), dark), vc({ rim: 0 }))
    eye.position.set(s * 0.14, 0.06, 0.2)
    eye.userData.noOutline = true
    head.add(eye)
  }
  const nose = new Mesh(paint(flat(new IcosahedronGeometry(0.035, 0)), dark), vc({ rim: 0 }))
  nose.position.set(0, -0.01, 0.3)
  nose.userData.noOutline = true
  head.add(nose)
  body.add(head)

  // paws holding a nut up to the mouth
  const hands = new Group()
  hands.position.set(0, 0.74, 0.3)
  const nut = new Mesh(paint(flat(new IcosahedronGeometry(0.09, 0)).scale(1, 1.25, 1), '#8a5a2a'), vc())
  nut.position.set(0, 0.06, 0.06)
  hands.add(nut)
  for (const s of [-1, 1]) {
    const paw = new Mesh(paint(flat(new CylinderGeometry(0.04, 0.05, 0.26, 5)).rotateX(1.1), fur), vc())
    paw.position.set(s * 0.09, -0.02, -0.02)
    hands.add(paw)
  }
  body.add(hands)

  const tail = new Group()
  tail.position.set(0, 0.2, -0.3)
  const puffs = [
    [0, 0.05, -0.08, 0.17], [0, 0.32, -0.28, 0.21], [0, 0.66, -0.34, 0.24], [0, 0.98, -0.22, 0.24], [0, 1.18, -0.02, 0.2],
  ].map(([x, y, z, rad], i) => blob(rad!, 1, 0.18, 70 + i).translate(x!, y!, z!))
  tail.add(new Mesh(paint(merge(puffs.map((g) => flat(g))), '#c4743a', 0.12, rng(3)), vc({ rim: 1.1 })))
  body.add(tail)
  for (const s of [-1, 1]) {
    const foot = new Mesh(paint(flat(new BoxGeometry(0.12, 0.08, 0.26)), fur), vc())
    foot.position.set(s * 0.17, 0.04, 0.12)
    body.add(foot)
  }
  outlineAll(body, 0.022, '#2a170c')
  root.traverse((o: any) => o.isMesh && o.name !== 'outline' && (o.castShadow = true))
  return { root, body, head, hands, tail }
}

// ---------------------------------------------------------------- koi

export function makeKoi(seed: number) {
  const r = rng(seed)
  const root = new Group()
  const o = r() * 10
  const pattern = (x: number, y: number, z: number): ColorRepresentation => {
    const n = noise3(x * 4 + o, y * 4, z * 2.4 + o)
    if (y < -0.05) return '#fff3e6'
    if (n > 0.38 && seed % 3 === 0) return '#1d1a1a'
    return n > -0.15 ? (seed % 4 === 1 ? '#f4e9dc' : '#ff6a1c') : '#fff3e6'
  }
  const body = new Mesh(paintBy(new IcosahedronGeometry(0.5, 1).scale(0.36, 0.3, 1.1), pattern), vc({ rim: 0.9 }))
  root.add(body)
  const tail = new Group()
  tail.position.z = -0.5
  const fin = paint(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, -0.28, 0.02, -0.45, 0.28, 0.02, -0.45]), 3)), '#ff8a3c')
  fin.computeVertexNormals()
  tail.add(new Mesh(fin, vc({ side: DoubleSide, rim: 0.5 })))
  root.add(tail)
  for (const s of [-1, 1]) {
    const f = paint(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, s * 0.19, -0.04, -0.2, 0, 0, -0.2]), 3)), '#ffd2b0')
    f.computeVertexNormals()
    const m = new Mesh(f, vc({ side: DoubleSide, rim: 0 }))
    m.position.set(s * 0.14, -0.08, 0.2)
    root.add(m)
  }
  addOutline(body, 0.03, '#3a1a0c')
  return { root, tail }
}

// ---------------------------------------------------------------- lily pad & lotus

export function lilyPadGeometry(radius: number, seed: number) {
  const r = rng(seed)
  const notch = range(r, 0.45, 0.7)
  const g = flat(new CylinderGeometry(radius, radius, 0.05, 20, 1, false, notch / 2, Math.PI * 2 - notch))
  return paintBy(g, (x, y, z) => {
    const d = Math.hypot(x, z) / radius
    return y > 0 ? (d > 0.82 ? '#7cbc4a' : (noise3(x * 2, 0, z * 2) > 0.2 ? '#5aa23c' : '#4f9636')) : '#3a7a2c'
  })
}

export function makeLotus(seed: number) {
  const r = rng(seed)
  const parts: BufferGeometry[] = []
  const ring = (n: number, len: number, tilt: number, color: string, off: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + off
      const g = flat(new ConeGeometry(0.11, len, 4)).scale(1, 1, 0.45)
      g.translate(0, len / 2, 0).rotateX(tilt).rotateY(a)
      parts.push(paint(g, color))
    }
  }
  ring(8, 0.42, 0.95, '#f49ac1', 0)
  ring(6, 0.38, 0.55, '#f8b5d2', 0.3)
  ring(5, 0.3, 0.22, '#fdd6e6', 0.1)
  parts.push(paint(flat(new CylinderGeometry(0.07, 0.07, 0.08, 6)).translate(0, 0.12, 0), '#f6d24a'))
  const m = new Mesh(merge(parts), vc({ rim: 1 }))
  m.rotation.y = r() * 6
  return m
}

// ---------------------------------------------------------------- campfire

export function makeCampfireWood() {
  const root = new Group()
  const r = rng(77)
  const logGeo = (len: number, rad: number) =>
    paintBy(new CylinderGeometry(rad, rad * 1.1, len, 7), (_x, y) => (Math.abs(y) > len / 2 - 0.01 ? '#d9a36a' : '#6a4128'))
  for (let i = 0; i < 5; i++) {
    const log = new Mesh(logGeo(1.15, 0.09), vc({ rim: 0.6 }))
    const a = (i / 5) * Math.PI * 2
    log.position.set(Math.cos(a) * 0.3, 0.38, Math.sin(a) * 0.3)
    log.rotation.set(0, -a, 0)
    log.rotateZ(0.62)
    log.castShadow = true
    addOutline(log, 0.02, '#1e120a')
    root.add(log)
  }
  for (let i = 0; i < 10; i++) {
    const stone = new Mesh(paint(flat(new DodecahedronGeometry(0.17, 0)), i % 2 ? '#7d7a74' : '#8f8b83'), vc({ rim: 0.4 }))
    const a = (i / 10) * Math.PI * 2
    stone.position.set(Math.cos(a) * 0.82, 0.06, Math.sin(a) * 0.82)
    stone.scale.set(range(r, 0.9, 1.3), range(r, 0.6, 0.85), range(r, 0.9, 1.2))
    stone.rotation.set(r() * 3, r() * 3, r() * 3)
    root.add(stone)
  }
  // a log to sit on
  const bench = new Mesh(logGeo(2.6, 0.26), vc({ rim: 0.6 }))
  bench.rotation.z = Math.PI / 2
  bench.rotation.y = 0.5
  bench.position.set(-2.4, 0.24, 2.0)
  bench.castShadow = true
  addOutline(bench, 0.03, '#1e120a')
  root.add(bench)
  return root
}
