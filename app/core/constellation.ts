import { MathUtils, Vector3 } from 'three'
import { CONSTELLATION_DIR } from './layout'

// "AC", drawn in stars. Points are in a flat (u, v) layout roughly 3.2 × 2 units, mapped onto
// the sky around CONSTELLATION_DIR. Stars live at infinity, so the shape is identical from the
// night sky high above and from beside the campfire at the end.

const A = [
  [-1.55, -1.0], // 0 foot left
  [-0.95, 1.0], // 1 apex
  [-0.35, -1.0], // 2 foot right
  [-1.27, -0.06], // 3 bar left
  [-0.63, -0.06], // 4 bar right
]
const C = [
  [1.58, 0.7], // 5
  [1.02, 1.0], // 6
  [0.5, 0.66], // 7
  [0.3, -0.04], // 8
  [0.5, -0.72], // 9
  [1.04, -1.0], // 10
  [1.6, -0.68], // 11
]
export const STAR_UV = [...A, ...C] as [number, number][]

/** Drawing order matters: anime.js draws these one after another as you scroll. */
export const LINES: [number, number][] = [
  [0, 3], [3, 1], [1, 4], [4, 2], [3, 4],
  [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
]

/** Stars that turn into contact links in the finale (indexed by ContactLink.star). */
export const ANCHORS = [1, 0, 6, 10]

/** Unit directions to each star, recomputed for the viewport so the letters always fit. */
export const starDirs = STAR_UV.map(() => new Vector3())

const SKY_FOV = 56

export function layoutConstellation(aspect: number) {
  const hfov = 2 * Math.atan(Math.tan(MathUtils.degToRad(SKY_FOV / 2)) * aspect)
  const k = Math.min(Math.tan(MathUtils.degToRad(19)), Math.tan(hfov * 0.34)) / 1.6
  const d = CONSTELLATION_DIR
  const right = new Vector3().crossVectors(d, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, d).normalize()
  STAR_UV.forEach(([u, v], i) => {
    starDirs[i]!.copy(d).addScaledVector(right, u * k).addScaledVector(up, v * k).normalize()
  })
}

layoutConstellation(16 / 9)
