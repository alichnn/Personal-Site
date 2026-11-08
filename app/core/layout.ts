import { Vector3 } from 'three'

// Where things are in the one continuous world. The sky scenes happen high above the
// meadow (y ≈ 200); the meadow, pond and campfire sit next to each other on the ground.

export const SKY_Y = 206
export const CLOUD_SEA_Y = 150
/** The final cloud wall the camera punches through. */
export const BURST_Z = 132

export const SIGN = new Vector3(3.6, 0, -212)
/** Where the bird perches in the meadow (x/z; the perch height is set by the twig). */
export const TWIG = new Vector3(-0.9, 0, -209.6)
export const WATER_Y = -0.3
export const POND = new Vector3(0, 0, -290)
export const POND_R = 22
/** Small rock islet in the pond where the bird lands. */
export const ISLET = new Vector3(-10.5, 0, -288)
export const ISLET_TOP = WATER_Y + 0.62
export const FIRE = new Vector3(14.5, 0, -266.5)

/** Direction (from any viewpoint, since stars are at infinity) to the centre of the AC constellation. */
export const CONSTELLATION_DIR = new Vector3(0, Math.sin((31 * Math.PI) / 180), -Math.cos((31 * Math.PI) / 180))

/** Gentle ground undulation, shared by terrain, grass and prop placement. */
export function groundHeight(x: number, z: number) {
  const dx = x - POND.x, dz = z - POND.z
  const r = Math.sqrt(dx * dx + dz * dz)
  // stays within -0.2..0.8 so the pond surface (WATER_Y) never shows through a dip
  let h =
    0.3 +
    Math.sin(x * 0.055 + 1.3) * Math.cos(z * 0.047) * 0.38 +
    Math.sin(x * 0.13 - z * 0.09) * 0.12
  // pond basin
  const basin = 1 - smoothstep(POND_R - 3.5, POND_R + 2.5, r)
  h = h * (1 - basin) - basin * 1.6
  // rolling hills further out
  const cx = x, cz = z + 240
  const far = Math.sqrt(cx * cx * 0.6 + cz * cz)
  h += smoothstep(90, 260, far) * (18 + Math.sin(x * 0.02 + z * 0.013) * 14)
  return h
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
