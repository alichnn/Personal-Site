import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, type ColorRepresentation } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Deterministic PRNG (mulberry32) so the world looks the same on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number
export const range = (r: Rand, a: number, b: number) => a + (b - a) * r()

// 3D value noise, for baking displacement into geometry on the CPU.
function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  ) * 2 - 1
}

/** Faceted normals: the low-poly look. */
export function flat<T extends BufferGeometry>(geo: T): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  g.computeVertexNormals()
  return g
}

/** Bake a solid color into a `color` attribute (for merging differently-colored parts). */
export function paint(geo: BufferGeometry, color: ColorRepresentation, vary = 0, rand?: Rand) {
  const c = new Color(color)
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 3) {
    // vary per face so facets read individually
    const k = vary && rand ? 1 + (rand() - 0.5) * vary : 1
    for (let j = 0; j < 3 && i + j < n; j++) {
      arr[(i + j) * 3] = c.r * k
      arr[(i + j) * 3 + 1] = c.g * k
      arr[(i + j) * 3 + 2] = c.b * k
    }
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3))
  return geo
}

/** Merge painted parts into one geometry (positions, normals, colors only). */
export function merge(parts: BufferGeometry[]) {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name)
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    return g
  })
  return mergeGeometries(clean, false)!
}

/** A noise-displaced icosphere: the building block for clouds, bushes, rocks and canopies. */
export function blob(radius: number, detail: number, wobble: number, seed: number, stretch: [number, number, number] = [1, 1, 1]) {
  const g = new IcosahedronGeometry(radius, detail)
  const pos = g.getAttribute('position') as BufferAttribute
  const o = seed * 13.37
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const f = 1.7 / radius
    const n = noise3(x * f + o, y * f, z * f) * 0.7 + noise3(x * f * 2.3, y * f * 2.3 + o, z * f * 2.3) * 0.3
    const s = 1 + n * wobble
    pos.setXYZ(i, x * s * stretch[0], y * s * stretch[1], z * s * stretch[2])
  }
  g.computeVertexNormals()
  return g
}
