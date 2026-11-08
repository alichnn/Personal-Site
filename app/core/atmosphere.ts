import { Color, DirectionalLight, FogExp2, HemisphereLight, MathUtils, PointLight, Vector3, type Scene } from 'three'
import { G } from './state'

// One lighting rig for the whole world. Every value here is keyframed on progress, so the
// transitions between scenes are just this rig moving through its keys.

interface AtmoKey {
  p: number
  zenith: string
  horizon: string
  fog: string
  fogDensity: number
  /** Sun azimuth (0 = straight ahead along -z, positive = toward +x) and elevation, degrees. */
  sunAz: number
  sunEl: number
  sun: string
  sunInt: number
  /** Size of the visible sun disc in the sky dome. */
  sunSize: number
  hemiSky: string
  hemiGround: string
  hemiInt: number
  rim: string
  rimStrength: number
  /** Bloom strength, radius, threshold. */
  bloom: [number, number, number]
  stars: number
}

const day = {
  rim: '#ffffff', rimStrength: 0.75, bloom: [0.16, 0.3, 0.97] as [number, number, number], stars: 0,
}

const KEYS: AtmoKey[] = [
  { p: 0.0, zenith: '#2a76ee', horizon: '#c4e4ff', fog: '#e6f2ff', fogDensity: 0.0045, sunAz: 30, sunEl: 40, sun: '#fff3dc', sunInt: 2.3, sunSize: 0.0012, hemiSky: '#d8ecff', hemiGround: '#9bb8e2', hemiInt: 1.55, ...day },
  { p: 0.096, zenith: '#2470ee', horizon: '#b9deff', fog: '#dcedff', fogDensity: 0.0032, sunAz: 30, sunEl: 40, sun: '#fff3dc', sunInt: 2.3, sunSize: 0.0012, hemiSky: '#d8ecff', hemiGround: '#9bb8e2', hemiInt: 1.55, ...day },
  { p: 0.112, zenith: '#1663f0', horizon: '#93d3ff', fog: '#a8daff', fogDensity: 0.0017, sunAz: 30, sunEl: 40, sun: '#fff1d6', sunInt: 2.4, sunSize: 0.0012, hemiSky: '#cfe6ff', hemiGround: '#8fb0e0', hemiInt: 1.45, ...day },
  { p: 0.205, zenith: '#1a5ce6', horizon: '#9fd4ff', fog: '#a9d6fb', fogDensity: 0.0017, sunAz: 20, sunEl: 30, sun: '#ffe9c8', sunInt: 2.2, sunSize: 0.0012, hemiSky: '#c9defa', hemiGround: '#8aa6d6', hemiInt: 1.4, ...day },
  { p: 0.262, zenith: '#28307e', horizon: '#d98ca0', fog: '#8a7cab', fogDensity: 0.0017, sunAz: 10, sunEl: 4, sun: '#ff9a72', sunInt: 1.2, sunSize: 0.002, hemiSky: '#8c86c8', hemiGround: '#4a4a7a', hemiInt: 1.0, rim: '#ffc2b0', rimStrength: 0.7, bloom: [0.45, 0.45, 0.85], stars: 0.15 },
  { p: 0.304, zenith: '#03061a', horizon: '#15265c', fog: '#0f1a3e', fogDensity: 0.0017, sunAz: 160, sunEl: 48, sun: '#9db4ff', sunInt: 0.45, sunSize: 0.0006, hemiSky: '#33478c', hemiGround: '#0d1430', hemiInt: 0.6, rim: '#a8c4ff', rimStrength: 0.55, bloom: [0.95, 0.5, 0.7], stars: 1 },
  { p: 0.394, zenith: '#03061a', horizon: '#15265c', fog: '#0f1a3e', fogDensity: 0.0017, sunAz: 160, sunEl: 48, sun: '#9db4ff', sunInt: 0.45, sunSize: 0.0006, hemiSky: '#33478c', hemiGround: '#0d1430', hemiInt: 0.6, rim: '#a8c4ff', rimStrength: 0.55, bloom: [0.95, 0.5, 0.7], stars: 1 },
  { p: 0.43, zenith: '#30479a', horizon: '#f4ad9c', fog: '#c39aa6', fogDensity: 0.0019, sunAz: -60, sunEl: 2, sun: '#ffb48a', sunInt: 1.1, sunSize: 0.002, hemiSky: '#a8a8d8', hemiGround: '#5a5a6a', hemiInt: 0.95, rim: '#ffd0b8', rimStrength: 0.65, bloom: [0.5, 0.45, 0.82], stars: 0.15 },
  { p: 0.474, zenith: '#3a8ae6', horizon: '#ffe3b4', fog: '#f4dfbd', fogDensity: 0.0042, sunAz: -62, sunEl: 20, sun: '#ffe2ac', sunInt: 2.5, sunSize: 0.0014, hemiSky: '#c4e2ff', hemiGround: '#6f8b3a', hemiInt: 1.35, rim: '#fff0c8', rimStrength: 0.6, bloom: [0.14, 0.3, 0.97], stars: 0 },
  { p: 0.62, zenith: '#3a8ae6', horizon: '#ffeac2', fog: '#f1e3c4', fogDensity: 0.0042, sunAz: -55, sunEl: 30, sun: '#fff0cc', sunInt: 2.5, sunSize: 0.0014, hemiSky: '#c4e2ff', hemiGround: '#6f8b3a', hemiInt: 1.35, rim: '#fff4d8', rimStrength: 0.6, bloom: [0.14, 0.3, 0.97], stars: 0 },
  { p: 0.7, zenith: '#3b82e0', horizon: '#ffe6bf', fog: '#efe0c4', fogDensity: 0.0045, sunAz: -38, sunEl: 26, sun: '#ffe6b8', sunInt: 2.4, sunSize: 0.0014, hemiSky: '#c4e0fa', hemiGround: '#6a8a40', hemiInt: 1.3, rim: '#fff0d0', rimStrength: 0.6, bloom: [0.14, 0.3, 0.97], stars: 0 },
  { p: 0.786, zenith: '#4a76cc', horizon: '#ffcf96', fog: '#f0cf9e', fogDensity: 0.0045, sunAz: -12, sunEl: 12, sun: '#ffcc88', sunInt: 2.2, sunSize: 0.0018, hemiSky: '#d6c8e0', hemiGround: '#6a7040', hemiInt: 1.2, rim: '#ffd6a0', rimStrength: 0.7, bloom: [0.4, 0.45, 0.88], stars: 0 },
  { p: 0.814, zenith: '#3a2a78', horizon: '#ff6326', fog: '#e46a40', fogDensity: 0.0042, sunAz: 2, sunEl: 2.5, sun: '#ff4e14', sunInt: 1.7, sunSize: 0.0034, hemiSky: '#cf7a86', hemiGround: '#3a2232', hemiInt: 0.85, rim: '#ff8a4a', rimStrength: 0.95, bloom: [0.45, 0.5, 0.85], stars: 0 },
  { p: 0.834, zenith: '#1a1450', horizon: '#c8341c', fog: '#7a2a2a', fogDensity: 0.0045, sunAz: 2, sunEl: -2, sun: '#ff3a10', sunInt: 0.9, sunSize: 0.0034, hemiSky: '#7a4a7a', hemiGround: '#20121e', hemiInt: 0.6, rim: '#ff7a3a', rimStrength: 0.9, bloom: [0.55, 0.5, 0.82], stars: 0.25 },
  { p: 0.858, zenith: '#02041a', horizon: '#111a40', fog: '#0a1028', fogDensity: 0.006, sunAz: 160, sunEl: 48, sun: '#8ea8f0', sunInt: 0.3, sunSize: 0.0006, hemiSky: '#2a3a74', hemiGround: '#0a0e20', hemiInt: 0.42, rim: '#8fa6e8', rimStrength: 0.4, bloom: [1.0, 0.55, 0.72], stars: 1 },
  { p: 1.0, zenith: '#02041a', horizon: '#111a40', fog: '#0a1028', fogDensity: 0.004, sunAz: 160, sunEl: 48, sun: '#8ea8f0', sunInt: 0.3, sunSize: 0.0006, hemiSky: '#2a3a74', hemiGround: '#0a0e20', hemiInt: 0.42, rim: '#8fa6e8', rimStrength: 0.4, bloom: [1.05, 0.55, 0.7], stars: 1 },
]

// Pre-parse colors once.
type Parsed = Omit<AtmoKey, 'zenith' | 'horizon' | 'fog' | 'sun' | 'hemiSky' | 'hemiGround' | 'rim'> & {
  zenith: Color; horizon: Color; fog: Color; sun: Color; hemiSky: Color; hemiGround: Color; rim: Color
}
const PARSED: Parsed[] = KEYS.map((k) => ({
  ...k,
  zenith: new Color(k.zenith), horizon: new Color(k.horizon), fog: new Color(k.fog), sun: new Color(k.sun),
  hemiSky: new Color(k.hemiSky), hemiGround: new Color(k.hemiGround), rim: new Color(k.rim),
}))

export class Atmosphere {
  readonly zenith = new Color()
  readonly horizon = new Color()
  readonly sunColor = new Color()
  readonly sunDir = new Vector3()
  sunSize = 0.001
  bloom: [number, number, number] = [0.3, 0.4, 0.9]
  readonly hemi: HemisphereLight
  readonly sun: DirectionalLight
  readonly fog: FogExp2
  /**
   * The campfire's light lives here from the start (at zero intensity) so every material is
   * compiled with it once, instead of recompiling the whole world when the fire appears.
   */
  readonly fireLight = new PointLight('#ff8a3a', 0, 24, 1.5)
  /** Extra white fog pushed in by cloud walls (0..1). */
  cloudFog = 0

  constructor(scene: Scene) {
    this.hemi = new HemisphereLight('#ffffff', '#888888', 1)
    this.sun = new DirectionalLight('#ffffff', 2)
    this.fog = new FogExp2('#ffffff', 0.002)
    this.fireLight.position.set(0, -50, 0)
    scene.add(this.hemi, this.sun, this.sun.target, this.fireLight)
    scene.fog = this.fog
  }

  update(p: number) {
    let i = 0
    while (i < PARSED.length - 2 && p > PARSED[i + 1]!.p) i++
    const a = PARSED[i]!, b = PARSED[i + 1]!
    let t = MathUtils.clamp((p - a.p) / (b.p - a.p), 0, 1)
    t = t * t * (3 - 2 * t)
    const n = (x: number, y: number) => x + (y - x) * t

    this.zenith.copy(a.zenith).lerp(b.zenith, t)
    this.horizon.copy(a.horizon).lerp(b.horizon, t)
    this.sunColor.copy(a.sun).lerp(b.sun, t)
    this.sunSize = n(a.sunSize, b.sunSize)
    const az = MathUtils.degToRad(n(a.sunAz, b.sunAz))
    const el = MathUtils.degToRad(n(a.sunEl, b.sunEl))
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))

    this.sun.color.copy(this.sunColor)
    // light from below the horizon would light things from underneath
    this.sun.intensity = n(a.sunInt, b.sunInt) * MathUtils.smoothstep(this.sunDir.y, -0.05, 0.08)
    this.hemi.color.copy(a.hemiSky).lerp(b.hemiSky, t)
    this.hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, t)
    this.hemi.intensity = n(a.hemiInt, b.hemiInt)

    this.fog.color.copy(a.fog).lerp(b.fog, t)
    this.fog.density = n(a.fogDensity, b.fogDensity)
    if (this.cloudFog > 0) {
      this.fog.color.lerp(CLOUD_WHITE, this.cloudFog * 0.8)
      this.fog.density += this.cloudFog * 0.03
    }

    G.uRimColor.value.copy(a.rim).lerp(b.rim, t)
    G.uRimStrength.value = n(a.rimStrength, b.rimStrength)
    G.uStars.value = n(a.stars, b.stars)
    G.uSunDir.value.copy(this.sunDir)
    G.uSunColor.value.copy(this.sunColor).multiplyScalar(this.sun.intensity / 2.4)
    G.uSkyAmb.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.6)
    G.uGroundAmb.value.copy(this.hemi.groundColor).multiplyScalar(this.hemi.intensity * 0.6)
    this.bloom = [n(a.bloom[0], b.bloom[0]), n(a.bloom[1], b.bloom[1]), n(a.bloom[2], b.bloom[2])]
  }

  /** Keep the sun's shadow camera centred on what we're looking at. */
  aimShadow(center: Vector3) {
    this.sun.target.position.copy(center)
    this.sun.position.copy(center).addScaledVector(this.sunDir.y > 0.05 ? this.sunDir : UP, 80)
  }
}

const CLOUD_WHITE = new Color('#f4f9ff')
const UP = new Vector3(0.2, 1, 0.1).normalize()
