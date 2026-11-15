import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three'
import type { World, WorldModule } from '../core/world'
import { G, state } from '../core/state'
import { POND, POND_R, WATER_Y } from '../core/layout'
import { TOON_BANDS } from '../core/glsl'
import { LANTERN_REST, T, bell, damp, smooth } from '../core/timeline'
import { flat, merge, paint, rng, range } from '../core/util'
import { addOutline, gradientMap, injectRim, toon } from '../core/toon'
import { soundscape } from '../core/audio'
import { projects, TYPES } from '../data/projects'
import { lilyPadGeometry } from './models'

// The project lanterns: lotus-petal bases with glowing paper shades. They float out of the reeds
// at the far bank one at a time, light up as they cross the middle of the pond, settle in a loose
// arc, and later lift off their bases and rise into the sunset as sky lanterns.
//
// The lanterns are only the picture: the HTML buttons over them (LanternLayer.vue) carry the
// titles and the clicks, and read `screen` each frame to stay on top of them.

/** The pond shader has room for this many lantern lights and wakes. */
export const MAX_LANTERNS = 6
const SCALE = 1.22
const SHADE_SEGMENTS = 8
/** Shade profile: [radius, height]. Wide at the waist, gathered at the top. */
const SHADE_PROFILE: [number, number][] = [[0.3, 0], [0.4, 0.12], [0.46, 0.38], [0.44, 0.62], [0.36, 0.84], [0.25, 0.96], [0.2, 1.0]]
const SHADE_Y = 0.1
/** Arrival paths start just inside these reed clumps on the far bank (x offsets from the pond centre). */
const REED_CLUMPS = [-6.5, 1.5, 8.5]

const SHADE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
#include <common>
#include <fog_pars_vertex>
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const SHADE_FRAG = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uGlowColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform float uGlow;
uniform float uFlicker;
uniform float uWarm;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
${TOON_BANDS}
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  // as they rise into the sunset every colour warms to the same gold
  vec3 paper = mix(uPaper, vec3(1.0, 0.8, 0.42), uWarm);
  vec3 glowC = mix(uGlowColor, vec3(1.0, 0.6, 0.2), uWarm);

  // unlit: plain paper in the evening light, in the world's toon bands
  float sun = toonBand(max(dot(N, uSunDir), 0.0) * 0.75 + 0.25);
  vec3 outside = paper * (uSkyAmb * 1.5 + uSunColor * 0.55 * sun);

  // lit from inside: brightest at the flame's height and on the facets we look through
  float h = vLocal.y;
  float core = exp(-pow((h - 0.4) / 0.36, 2.0));
  float facing = clamp(dot(N, V), 0.0, 1.0);
  float inner = toonBand((0.35 + 0.65 * facing) * (0.45 + 0.55 * core));
  // every type glows equally bright: green looks far brighter than blue at the same strength
  float lum = dot(glowC, vec3(0.2126, 0.7152, 0.0722));
  vec3 lit = glowC * (0.72 / max(lum, 0.2)) * inner * 2.4 + paper * 0.6;

  vec3 col = mix(outside, lit, clamp(uGlow, 0.0, 1.0)) * mix(1.0, uFlicker, uGlow);
  col += glowC * max(uGlow - 1.0, 0.0) * inner * 2.0;

  // a fine bamboo frame: ribs on the facet seams and two hoops
  float seam = abs(fract(atan(vLocal.x, vLocal.z) / 6.2831853 * ${SHADE_SEGMENTS}.0) - 0.5);
  float rib = smoothstep(0.455, 0.49, seam);
  float hoop = 1.0 - smoothstep(0.008, 0.016, min(abs(h - 0.2), abs(h - 0.78)));
  col = mix(col, vec3(0.22, 0.12, 0.06) * (0.6 + 0.9 * uGlow), max(rib, hoop) * 0.8);

  gl_FragColor = vec4(col, uOpacity);
  #include <fog_fragment>
}`

interface Lantern {
  root: Group
  shade: Group
  shadeMat: ShaderMaterial
  baseMat: MeshToonMaterial
  halo: Sprite
  glow: Color
  /** Where it settles in the arc. */
  slot: Vector3
  /** Where it emerges from the reeds. */
  start: Vector3
  ctrl: Vector3
  /** Lit from inside: switched on when it crosses the middle of the pond. */
  lit: boolean
  litAt: number
  level: number
  hoverK: number
  openK: number
  wasHover: boolean
}

export class Lanterns implements WorldModule {
  range: [number, number] = [0.6, 1]
  group = new Group()
  built = false
  readonly count = Math.min(projects.length, MAX_LANTERNS)
  /** Where each lantern is on screen, for the HTML layer (CSS pixels). */
  readonly screen = Array.from({ length: this.count }, () => ({ x: 0, y: 0, r: 0, top: 0, on: false }))
  private items: Lantern[] = []
  private cam = new PerspectiveCamera()
  private v = new Vector3()
  private v2 = new Vector3()
  private ray = new Ray()
  private pt = { x: 0, y: 0 }
  private laidOut = ''

  build(w: World) {
    const r = rng(305)
    this.buildReeds(r)
    const shadeGeo = flat(new LatheGeometry(SHADE_PROFILE.map(([x, y]) => new Vector2(x, y)), SHADE_SEGMENTS))
    const haloTex = haloTexture()
    for (let i = 0; i < this.count; i++) {
      const type = TYPES[projects[i]!.type]
      const root = new Group()
      root.scale.setScalar(SCALE)

      const baseMat = new MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap, emissive: new Color(type.glow), emissiveIntensity: 0 })
      baseMat.onBeforeCompile = (shader) => injectRim(shader, 0.8)
      baseMat.customProgramCacheKey = () => 'toon-rim'
      const base = new Mesh(lanternBaseGeometry(900 + i), baseMat)
      addOutline(base, 0.025, '#3a2016')
      root.add(base)

      const shade = new Group()
      shade.position.y = SHADE_Y
      const shadeMat = new ShaderMaterial({
        uniforms: UniformsUtils.merge([UniformsLib.fog]),
        vertexShader: SHADE_VERT,
        fragmentShader: SHADE_FRAG,
        side: DoubleSide,
        transparent: true,
        fog: true,
      })
      Object.assign(shadeMat.uniforms, {
        uPaper: { value: new Color(type.paper) },
        uGlowColor: { value: new Color(type.glow) },
        uSunDir: G.uSunDir,
        uSunColor: G.uSunColor,
        uSkyAmb: G.uSkyAmb,
        uGlow: { value: 0 },
        uFlicker: { value: 1 },
        uWarm: { value: 0 },
        uOpacity: { value: 0.95 },
      })
      const paper = new Mesh(shadeGeo, shadeMat)
      paper.renderOrder = 4
      shade.add(paper)
      const rimMat = toon('#4a2c18', { rim: 0.4 })
      for (const [rad, y] of [[0.31, 0.01], [0.21, 0.99]] as const) {
        const ring = new Mesh(flat(new CylinderGeometry(rad, rad, 0.045, SHADE_SEGMENTS, 1, true)), rimMat)
        ring.position.y = y
        shade.add(ring)
      }
      const halo = new Sprite(new SpriteMaterial({ map: haloTex, color: new Color(type.glow), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
      halo.position.y = 0.45
      halo.scale.setScalar(2.4)
      halo.renderOrder = 5
      shade.add(halo)
      root.add(shade)

      root.visible = false
      this.group.add(root)
      this.items.push({
        root, shade, shadeMat, baseMat, halo, glow: new Color(type.glow),
        slot: new Vector3(), start: new Vector3(), ctrl: new Vector3(),
        lit: false, litAt: -10, level: 0, hoverK: 0, openK: 0, wasHover: false,
      })
    }
    this.layout(w)
  }

  /** Tall reeds and cattails at the far bank, where the lanterns float out from. */
  private buildReeds(r: () => number) {
    const blades: Matrix4[] = []
    const heads: Matrix4[] = []
    const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), axis = new Vector3()
    for (const cx of REED_CLUMPS) {
      const edgeZ = POND.z - Math.sqrt(POND_R * POND_R - cx * cx)
      for (let k = 0; k < 22; k++) {
        const x = cx + range(r, -2.2, 2.2), z = edgeZ + range(r, 0.2, 2.6)
        const h = range(r, 1.3, 2.7)
        p.set(x, WATER_Y - 0.1, z)
        axis.set(range(r, -1, 1), 0, range(r, -1, 1)).normalize()
        q.setFromAxisAngle(axis, range(r, -0.14, 0.14))
        s.set(range(r, 0.8, 1.3), h, range(r, 0.8, 1.3))
        blades.push(new Matrix4().compose(p, q, s))
        if (k % 3 === 0) {
          // the cattail head sits near the tip of its blade
          const tip = new Vector3(0, h * 0.86, 0).applyQuaternion(q).add(p)
          heads.push(m.clone().compose(tip, q, new Vector3(1, 1, 1)))
        }
      }
    }
    const bladeGeo = flat(new ConeGeometry(0.045, 1, 3)).translate(0, 0.5, 0)
    const bladeMesh = new InstancedMesh(bladeGeo, toon('#4f7f34', { rim: 0.8 }), blades.length)
    blades.forEach((mm, i) => bladeMesh.setMatrixAt(i, mm))
    const headGeo = flat(new CylinderGeometry(0.07, 0.065, 0.36, 6))
    const headMesh = new InstancedMesh(headGeo, toon('#6b4226', { rim: 0.5 }), heads.length)
    heads.forEach((mm, i) => headMesh.setMatrixAt(i, mm))
    for (const mesh of [bladeMesh, headMesh]) {
      mesh.computeBoundingSphere()
      this.group.add(mesh)
    }
  }

  /**
   * The arc is laid out on screen, then dropped onto the water from the plateau's resting camera,
   * so it reads as balanced on any screen and for any number of lanterns: a gentle arc on wide
   * screens, and on tall ones a zig-zag that recedes up the screen.
   */
  private layout(w: World) {
    const aspect = state.width / Math.max(1, state.height)
    const key = `${aspect.toFixed(3)}|${w.rig.narrow.toFixed(3)}`
    if (key === this.laidOut) return
    this.laidOut = key
    const pos = new Vector3(), look = new Vector3()
    const { fov } = w.rig.sample(LANTERN_REST, pos, look)
    const cam = this.cam
    cam.fov = fov
    cam.aspect = aspect
    cam.near = 0.1
    cam.far = 500
    cam.position.copy(pos)
    cam.lookAt(look)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    const n = this.count
    const targets = arcTargets(n, aspect)
    const r = rng(71)
    this.items.forEach((l, i) => {
      const [x, y] = targets[i]!
      this.ray.origin.copy(cam.position)
      this.ray.direction.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize()
      const k = (WATER_Y + 0.02 - this.ray.origin.y) / Math.min(-1e-3, this.ray.direction.y)
      this.ray.at(k, l.slot)
      // emerge from the reeds, then cross the middle of the pond on the way to the arc
      const cx = REED_CLUMPS[i % REED_CLUMPS.length]! * 0.85
      const edgeZ = POND.z - Math.sqrt(POND_R * POND_R - cx * cx)
      l.start.set(POND.x + cx, WATER_Y + 0.02, edgeZ + 0.9)
      l.ctrl.set(POND.x + (l.start.x + l.slot.x) * 0.25 + range(r, -1, 1), WATER_Y + 0.02, POND.z - 1.5)
    })
  }

  resize(w: World) {
    this.layout(w)
  }

  /** Lantern i's arrival window: it leaves the reeds at [0] and settles in the arc at [1]. */
  private window(i: number): [number, number] {
    const [a, b] = T.lanternArrive
    const n = this.count
    const travel = (b - a) * (n > 1 ? 0.62 : 1)
    const stagger = n > 1 ? (b - a - travel) / (n - 1) : 0
    return [a + i * stagger, a + i * stagger + travel]
  }

  private pathAt(l: Lantern, t: number, out: Vector3) {
    // quadratic Bézier from the reeds, through the middle of the pond, to the slot
    const u = 1 - t
    return out.set(
      u * u * l.start.x + 2 * u * t * l.ctrl.x + t * t * l.slot.x,
      WATER_Y + 0.02,
      u * u * l.start.z + 2 * u * t * l.ctrl.z + t * t * l.slot.z,
    )
  }

  update(w: World) {
    this.layout(w)
    const wp = state.wp
    const t = state.time
    const dt = state.dt
    const reduced = state.reduced
    const motion = reduced ? 0 : 1
    const ui = state.lanternUi
    const live = wp > T.lanterns[0] && wp < T.lanterns[3]
    const rise = smooth(wp, T.lanternRise[0], T.lanternRise[1])
    const warm = smooth(rise, 0.12, 0.7)
    // after the rise the empty bases keep a faint glow, catching the sunset, and fade as night comes
    const baseGlow = rise > 0 ? 0.35 * smooth(rise, 0, 0.15) * (1 - 0.7 * smooth(wp, T.gather[0], T.gather[1] + 0.01)) : 0
    const pond = w.pond

    this.items.forEach((l, i) => {
      const [from, to] = this.window(i)
      const s = smooth(wp, from, to)
      // each one waits out of sight in the reeds until its turn
      const shown = wp > from - 0.002
      l.root.visible = shown
      if (!shown) {
        l.lit = false
        l.level = 0
        if (i < MAX_LANTERNS) pond.lanternLights[i]!.z = 0
        this.screen[i]!.on = false
        return
      }

      // position: along the arrival path, then bobbing gently in the arc
      this.pathAt(l, s, l.root.position)
      const settled = smooth(s, 0.85, 1)
      l.root.position.y += (Math.sin(t * 1.1 + i * 1.7) * 0.035 + Math.sin(t * 0.6 + i) * 0.02) * motion * settled
      const hover = ui.hover === i, open = ui.open === i
      l.hoverK = damp(l.hoverK, hover || open ? 1 : 0, 6, dt)
      l.openK = damp(l.openK, open ? 1 : 0, 5, dt)
      l.root.position.y += 0.16 * l.hoverK * (1 - rise)
      if (s < 1) {
        // face along the path while travelling
        this.pathAt(l, Math.min(1, s + 0.02), this.v)
        const yaw = Math.atan2(this.v.x - l.root.position.x, this.v.z - l.root.position.z)
        l.root.rotation.y = MathUtils.lerp(yaw, l.root.rotation.y, settled)
      }
      l.root.rotation.y += 0.08 * dt * motion * (1 - 0.8 * l.hoverK)
      l.root.rotation.z = Math.sin(t * 0.9 + i * 2.3) * 0.03 * motion * settled

      // light up on crossing the middle of the pond: a warm flicker-on, then a steady glow
      const shouldLight = s > 0.5
      if (shouldLight && !l.lit) {
        l.lit = true
        l.litAt = t
        // only when it happens in front of someone (not when jumping in from a link)
        if (state.speed > 0.01 && !reduced) soundscape.lanternOn(i)
      } else if (!shouldLight && l.lit) l.lit = false
      const target = l.lit ? (reduced ? 1 : flickerOn(t - l.litAt)) : 0
      l.level = l.lit ? target : Math.max(0, l.level - dt * 3)

      // brighter on hover/focus, flaring when its card opens, and the first lantern's one-time pulse
      const flare = open ? bell(t - ui.flareAt, 0, 0.12, 0.35, 1.1) : 0
      const pulse = ui.pulseIndex === i ? bell(t - ui.pulseAt, 0, 0.25, 0.45, 1.3) : 0
      const boost = 1 + 0.32 * l.hoverK + 0.18 * l.openK + 0.9 * flare + 0.7 * pulse
      const flick = reduced ? 1 : 0.93 + 0.05 * Math.sin(t * 9.1 + i * 3) + 0.03 * Math.sin(t * 23.3 + i)
      const glow = l.level * boost

      // the rise: the shade lifts off its base and climbs into the sunset as a sky lantern
      const k = rise
      l.shade.position.set(
        Math.sin(i * 2.4 + 1) * 3.5 * k * k + Math.sin(t * 0.5 + i) * 0.4 * k * motion,
        SHADE_Y + (0.9 * smooth(k, 0, 0.12) + 70 * Math.pow(k, 2.1)) / SCALE,
        -46 * k * k / SCALE,
      )
      l.shade.rotation.y = t * 0.15 * k * motion
      const u = l.shadeMat.uniforms
      u.uGlow!.value = rise > 0 ? Math.max(glow, smooth(k, 0, 0.1)) : glow
      u.uFlicker!.value = flick
      u.uWarm!.value = warm
      u.uOpacity!.value = 0.95 * (1 - smooth(k, 0.82, 1))
      l.shade.visible = k < 0.999
      const haloA = Math.min(1.4, u.uGlow!.value) * (1 - smooth(k, 0.82, 1))
      ;(l.halo.material as SpriteMaterial).opacity = haloA * (0.38 + 0.4 * k)
      ;(l.halo.material as SpriteMaterial).color.copy(l.glow).lerp(GOLD, warm)
      l.halo.scale.setScalar(2.4 * (1 + 0.35 * l.hoverK + 0.5 * flare) * (1 + 1.8 * k))
      // a lit lantern lights its own petals; after the rise the empty base keeps a faint glow
      l.baseMat.emissiveIntensity = Math.max(baseGlow, 0.2 * glow * (1 - k))
      l.baseMat.emissive.copy(l.glow).lerp(GOLD, 0.6)

      // its light on the water (and a wake while it travels)
      if (i < MAX_LANTERNS) {
        const lightOnWater = glow * flick * (1 - smooth(k, 0.05, 0.35)) + baseGlow * 0.35
        pond.lanternLights[i]!.set(l.root.position.x, l.root.position.z, lightOnWater, 0)
        pond.lanternColors[i]!.copy(l.glow)
        const travel = bell(s, 0.0, 0.08, 0.88, 1) * motion
        this.pathAt(l, Math.min(1, s + 0.01), this.v)
        this.v2.set(this.v.x - l.root.position.x, 0, this.v.z - l.root.position.z).normalize()
        pond.lanternWakes[i]!.set(this.v2.x, this.v2.z, travel, 0)
      }

      // hover starts a ripple ring
      if (hover && !l.wasHover && live) pond.addRipple(l.root.position.x, l.root.position.z, 0.9, t)
      l.wasHover = hover

      // where it is on screen, for the HTML button and title
      const sc = this.screen[i]!
      this.v.copy(l.root.position).setY(l.root.position.y + (SHADE_Y + 0.45) * SCALE)
      const front = w.project(this.v, this.pt)
      sc.x = this.pt.x
      sc.y = this.pt.y
      this.v2.setFromMatrixColumn(w.camera.matrixWorld, 0).multiplyScalar(0.62 * SCALE).add(this.v)
      w.project(this.v2, this.pt)
      sc.r = Math.hypot(this.pt.x - sc.x, this.pt.y - sc.y)
      this.v.y = l.root.position.y + (SHADE_Y + 1.12) * SCALE
      w.project(this.v, this.pt)
      sc.top = this.pt.y
      sc.on = front && live && s > 0.98
    })

    // hold the camera still while someone is choosing or reading
    const engaged = live && (ui.hover >= 0 || ui.open >= 0)
    state.lanternHold = damp(state.lanternHold, engaged ? 1 : 0, 4, dt)
  }
}

const GOLD = new Color('#ffb04a')

/** Where each lantern sits on screen (NDC), left to right. */
function arcTargets(n: number, aspect: number): [number, number][] {
  const u = (i: number) => (n > 1 ? i / (n - 1) : 0.5)
  if (aspect >= 0.9) {
    // a gentle arc, the middle a little further away
    const span = Math.min(0.62, 0.21 * (n - 1))
    return Array.from({ length: n }, (_, i) => {
      const x = (u(i) * 2 - 1) * span
      const e = span > 0 ? x / span : 0
      return [x, -0.36 + 0.13 * (1 - e * e)]
    })
  }
  // tall screens: alternate sides while receding up the screen
  const bottom = -0.56
  const top = bottom + Math.min(0.68, 0.25 * (n - 1))
  return Array.from({ length: n }, (_, i) => [(i % 2 ? 0.42 : -0.42) * (1 - 0.2 * u(i)), bottom + (top - bottom) * u(i)])
}

/** A warm flicker-on over about a second, settling to a steady 1. */
function flickerOn(dt: number) {
  if (dt >= 0.95) return 1
  const b = smooth(dt, 0, 0.9)
  return b * (0.5 + 0.5 * (b > 0.97 ? 1 : Math.abs(Math.sin(dt * 31) * Math.sin(dt * 17 + 1))))
}

/** A small lily pad with two rings of lotus petals cupping the shade. */
function lanternBaseGeometry(seed: number) {
  const r = rng(seed)
  const parts: BufferGeometry[] = [lilyPadGeometry(0.78, seed)]
  const ring = (count: number, len: number, wid: number, tilt: number, at: number, colors: string[], off: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + off + range(r, -0.06, 0.06)
      const g = flat(new ConeGeometry(wid, len, 4)).scale(1, 1, 0.42)
      g.translate(0, len / 2, 0).rotateX(tilt).translate(0, 0.03, at).rotateY(a)
      parts.push(paint(g, colors[i % colors.length]!))
    }
  }
  ring(9, 0.6, 0.2, 1.05, 0.34, ['#f4bfd2', '#f8cfdd'], 0)
  ring(8, 0.48, 0.17, 0.6, 0.28, ['#fbdde8', '#fde9f0'], 0.35)
  parts.push(paint(flat(new DodecahedronGeometry(0.3, 0)).scale(1, 0.25, 1).translate(0, 0.04, 0), '#f6d27a'))
  return merge(parts)
}

/** A soft, banded halo: three rings, like the toon light everywhere else. */
function haloTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.45)')
  g.addColorStop(0.57, 'rgba(255,255,255,0.16)')
  g.addColorStop(0.85, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}
