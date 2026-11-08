import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { CONSTELLATION_DIR, groundHeight } from './layout'
import { state } from './state'
import { damp, lerp, smooth } from './timeline'

interface Key {
  p: number
  pos: Vector3
  look: Vector3
  fov: number
  /** Idle-drift amplitude in world units (big in the sky, small near props). */
  drift: number
  /** Alternative look target for portrait screens, where the horizontal view is narrow. */
  lookNarrow?: Vector3
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
/** A point `dy` above the ground. */
const g = (x: number, dy: number, z: number) => new Vector3(x, groundHeight(x, z) + dy, z)

function finaleLook(from: Vector3, elevDeg: number) {
  const e = MathUtils.degToRad(elevDeg)
  const d = new Vector3(CONSTELLATION_DIR.x, 0, CONSTELLATION_DIR.z).normalize()
  return from.clone().add(d.multiplyScalar(Math.cos(e) * 60)).add(v(0, Math.sin(e) * 60, 0))
}

const fireCam = g(6.6, 2.4, -256.2)

// Keyframes pair up around each text block: two nearby positions spanning a long stretch of
// scroll make a plateau (the camera barely moves while the text holds); the gaps between
// pairs are the fast flights.
const KEYS: Key[] = [
  { p: 0.0, pos: v(0, 206, 560), look: v(0, 206, 420), fov: 60, drift: 2.2 },
  { p: 0.05, pos: v(-4, 204, 390), look: v(4, 205, 250), fov: 62, drift: 2.2 },
  { p: 0.1, pos: v(2, 205.5, 178), look: v(0, 206, 40), fov: 64, drift: 2 },
  { p: 0.118, pos: v(0, 206, 104), look: v(0, 206.4, -20), fov: 54, drift: 1.4 },
  // hero hold
  { p: 0.132, pos: v(0, 206, 90), look: v(0, 206.4, -30), fov: 50, drift: 1.2 },
  { p: 0.196, pos: v(0, 206.1, 84), look: v(0, 206.6, -36), fov: 50, drift: 1.2 },
  // people hold: the view starts to lift toward the sky
  { p: 0.214, pos: v(0, 209, 64), look: v(0, 221, -60), fov: 52, drift: 1.4 },
  { p: 0.262, pos: v(0, 210, 57), look: v(0, 225, -66), fov: 52, drift: 1.4 },
  // night: tilted up into the stars
  { p: 0.306, pos: v(0, 214, 32), look: v(0, 258, -80), fov: 56, drift: 1.2 },
  { p: 0.392, pos: v(0, 215, 25), look: v(0, 261, -86), fov: 56, drift: 1.2 },
  // falling with the seeds
  { p: 0.425, pos: v(0, 150, -55), look: v(0, 70, -170), fov: 58, drift: 1 },
  { p: 0.456, pos: v(0, 34, -146), look: v(1, 8, -205), fov: 55, drift: 0.6 },
  { p: 0.478, pos: g(0.4, 4.4, -192), look: g(2.6, 2.4, -212), fov: 50, drift: 0.25 },
  // signpost hold
  { p: 0.506, pos: g(1.0, 2.75, -201.2), look: g(3.5, 2.15, -212), fov: 48, drift: 0.12 },
  { p: 0.6, pos: g(1.15, 2.78, -202.1), look: g(3.5, 2.15, -212), fov: 48, drift: 0.12 },
  // glance at the bird on its twig; the bird module takes over the camera from here
  { p: 0.618, pos: g(1.4, 2.3, -204.4), look: g(-0.9, 1.6, -209.6), fov: 50, drift: 0.12 },
  { p: 0.642, pos: g(-6, 10, -228), look: g(-10, 4, -250), fov: 56, drift: 0.3 },
  { p: 0.672, pos: g(0, 8.6, -258.5), look: v(0.5, -0.3, -283), fov: 50, drift: 0.3 },
  // work hold
  { p: 0.697, pos: g(0, 8.4, -260.5), look: v(0.8, -0.3, -284), fov: 48, drift: 0.25 },
  { p: 0.79, pos: g(0, 8.2, -261.6), look: v(0.8, -0.3, -284.5), fov: 48, drift: 0.25 },
  // sunset across the water
  { p: 0.816, pos: g(3, 3.0, -258), look: v(2, 2.6, -330), fov: 52, drift: 0.2 },
  { p: 0.84, pos: g(5, 2.7, -257), look: g(9, 1.2, -284), fov: 52, drift: 0.15 },
  // campfire hold (long, for browsing albums)
  { p: 0.868, pos: fireCam.clone(), look: g(11.2, 1.55, -270.5), lookNarrow: g(13.6, 2.3, -266.9), fov: 50, drift: 0.1 },
  { p: 0.948, pos: fireCam.clone().add(v(0.1, 0, -0.5)), look: g(11.2, 1.65, -271), lookNarrow: g(13.6, 2.4, -267), fov: 50, drift: 0.1 },
  // tilt up into the stars
  { p: 0.985, pos: fireCam.clone().add(v(0, 0.3, -0.8)), look: finaleLook(fireCam, 24), fov: 56, drift: 0.12 },
  { p: 1.0, pos: fireCam.clone().add(v(0, 0.35, -0.9)), look: finaleLook(fireCam, 24.5), fov: 56, drift: 0.12 },
]

const LUT_N = 4096
/** Blur radius of the remap, in scroll progress; turns plateau corners into eases. */
const REMAP_SMOOTH = 0.009

export class CameraRig {
  readonly camera: PerspectiveCamera
  private posCurve = new CatmullRomCurve3(KEYS.map((k) => k.pos), false, 'centripetal')
  private lookCurve = new CatmullRomCurve3(KEYS.map((k) => k.look), false, 'centripetal')
  private lookNarrowCurve = new CatmullRomCurve3(KEYS.map((k) => k.lookNarrow ?? k.look), false, 'centripetal')
  private narrowTmp = new Vector3()
  /** 0 on landscape screens, 1 on tall portrait ones. */
  narrow = 0
  private lut = new Float32Array(LUT_N)

  private pos = new Vector3()
  private look = new Vector3()
  private fov = 60
  private tPos = new Vector3()
  private tLook = new Vector3()
  private tmp = new Vector3()
  private driftAmt = 0.4
  private first = true

  /** Set each frame by scenes that briefly take over the camera (e.g. following the bird). */
  override: { weight: number; pos: Vector3; look: Vector3 } = { weight: 0, pos: new Vector3(), look: new Vector3() }
  /** Extra FOV in degrees (burst kick). */
  fovKick = 0
  /** 0..1 shake from wind gusts. */
  shake = 0
  /** Offset applied before damping, e.g. the loader push-in. */
  offset = new Vector3()

  constructor(camera: PerspectiveCamera) {
    this.camera = camera
    this.buildLut()
  }

  /** Scroll progress → curve parameter, with plateaus where keys are close together. */
  private buildLut() {
    const n = KEYS.length - 1
    const raw = new Float32Array(LUT_N)
    let k = 0
    for (let i = 0; i < LUT_N; i++) {
      const p = i / (LUT_N - 1)
      while (k < n - 1 && p > KEYS[k + 1]!.p) k++
      const a = KEYS[k]!.p, b = KEYS[k + 1]!.p
      raw[i] = (k + Math.min(1, Math.max(0, (p - a) / (b - a)))) / n
    }
    // three box blurs ≈ gaussian
    const r = Math.round(REMAP_SMOOTH * LUT_N)
    const at = (a: Float32Array, i: number) => a[Math.min(LUT_N - 1, Math.max(0, i))]!
    let src = raw
    for (let pass = 0; pass < 3; pass++) {
      const dst = new Float32Array(LUT_N)
      let acc = 0
      for (let i = -r; i <= r; i++) acc += at(src, i)
      for (let i = 0; i < LUT_N; i++) {
        dst[i] = acc / (2 * r + 1)
        acc += at(src, i + r + 1) - at(src, i - r)
      }
      src = dst
    }
    this.lut.set(src)
  }

  private curveT(p: number) {
    const x = Math.min(1, Math.max(0, p)) * (LUT_N - 1)
    const i = Math.floor(x)
    const a = this.lut[i]!, b = this.lut[Math.min(LUT_N - 1, i + 1)]!
    return a + (b - a) * (x - i)
  }

  /** Path target for progress p (no drift or damping). */
  sample(p: number, outPos: Vector3, outLook: Vector3) {
    const t = this.curveT(p)
    this.posCurve.getPoint(t, outPos)
    this.lookCurve.getPoint(t, outLook)
    if (this.narrow > 0) outLook.lerp(this.lookNarrowCurve.getPoint(t, this.narrowTmp), this.narrow)
    const x = t * (KEYS.length - 1)
    const i = Math.min(KEYS.length - 2, Math.floor(x))
    const f = smooth(x - i, 0, 1)
    return { fov: lerp(KEYS[i]!.fov, KEYS[i + 1]!.fov, f), drift: lerp(KEYS[i]!.drift, KEYS[i + 1]!.drift, f) }
  }

  snap() {
    this.first = true
  }

  update(dt: number, p: number) {
    const cam = this.camera
    const { fov, drift } = this.sample(p, this.tPos, this.tLook)
    this.tPos.add(this.offset)

    const o = this.override
    if (o.weight > 0) {
      this.tPos.lerp(o.pos, o.weight)
      this.tLook.lerp(o.look, o.weight)
    }

    // Idle drift: always a little alive, fuller once scrolling stops, and nearly still
    // while the visitor is browsing albums.
    const t = state.time
    const idleTarget = state.reduced ? 0 : (state.idle > 0.35 ? 1 : 0.35) * (1 - 0.95 * state.holdCamera)
    this.driftAmt = damp(this.driftAmt, idleTarget, 1.1, dt)
    // narrow screens see much less horizontally, so the same sway would push text off-screen
    const s = this.driftAmt * drift * (1 - 0.65 * this.narrow)
    this.tPos.x += (Math.sin(t * 0.23) * 0.9 + Math.sin(t * 0.11 + 1.3) * 0.5) * s
    this.tPos.y += Math.sin(t * 0.19 + 0.7) * 0.45 * s
    this.tPos.z += Math.sin(t * 0.15 + 2.1) * 0.5 * s
    this.tLook.x += Math.sin(t * 0.17 + 0.4) * 0.7 * s
    this.tLook.y += Math.sin(t * 0.21 + 1.9) * 0.4 * s

    const targetFov = fov + this.fovKick + Math.sin(t * 0.25) * 0.6 * this.driftAmt

    if (this.first || state.reduced) {
      this.pos.copy(this.tPos)
      this.look.copy(this.tLook)
      this.fov = targetFov
      this.first = false
    } else {
      const k = 1 - Math.exp(-4.2 * dt)
      this.pos.lerp(this.tPos, k)
      this.look.lerp(this.tLook, 1 - Math.exp(-5 * dt))
      this.fov = damp(this.fov, targetFov, 6, dt)
    }

    cam.position.copy(this.pos)
    if (this.shake > 0.001) {
      const a = this.shake * 0.35
      this.tmp.set(
        Math.sin(t * 23.1) + Math.sin(t * 37.7) * 0.5,
        Math.sin(t * 19.3 + 1) + Math.sin(t * 31.9) * 0.5,
        0,
      ).multiplyScalar(a)
      cam.position.add(this.tmp)
    }
    cam.lookAt(this.look)
    cam.rotateZ(Math.sin(t * 0.13) * 0.012 * this.driftAmt * Math.min(1, drift))
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov
      cam.updateProjectionMatrix()
    }
  }
}
