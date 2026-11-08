import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  Vector4,
} from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { G, state } from '../core/state'
import { FIRE, ISLET, ISLET_TOP, POND, POND_R, WATER_Y } from '../core/layout'
import { NOISE } from '../core/glsl'
import { T, bell, roleSlot, smooth } from '../core/timeline'
import { flat, paint, rng, range } from '../core/util'
import { toon } from '../core/toon'
import { roles } from '../data/content'
import { lilyPadGeometry, makeKoi, makeLotus } from './models'
import { makeFlames } from './flame'

const RIPPLES = 12
const FLAMES = 40
const EMBERS = 220

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vLocal;
#include <common>
#include <fog_pars_vertex>
void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uR;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec4 uRipples[${RIPPLES}];
uniform float uGlow;
uniform float uBurn;
uniform float uGather;
uniform vec3 uFirePos;
uniform float uFireIntensity;
uniform vec3 uSkyAmb;
varying vec3 vWorld;
varying vec2 vLocal;
${NOISE}
#include <common>
#include <fog_pars_fragment>
void main() {
  float r = length(vLocal) / uR;
  float t = uTime;

  // ripples: expanding toon rings that also tilt the normal
  vec3 N = vec3(0.0, 1.0, 0.0);
  float rings = 0.0;
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 rp = uRipples[i];
    float age = t - rp.z;
    if (age < 0.0 || age > 3.5 || rp.w <= 0.0) continue;
    vec2 d = vWorld.xz - rp.xy;
    float dist = length(d);
    float rad = age * 1.9;
    float band = 1.0 - smoothstep(0.0, 0.16, abs(dist - rad));
    float fade = (1.0 - age / 3.5) * rp.w;
    rings += band * fade;
    N.xz += (d / max(dist, 1e-3)) * band * fade * 0.35;
  }
  N = normalize(N + vec3((vnoise(vWorld.xz * 0.8 + t * 0.4) - 0.5) * 0.05, 0.0, (vnoise(vWorld.zx * 0.8 - t * 0.35) - 0.5) * 0.05));

  // banded depth: shallow teal at the edge, deep blue-green in the middle
  float depth = (1.0 - smoothstep(0.2, 1.0, r)) + (vnoise(vWorld.xz * 0.25 + t * 0.03) - 0.5) * 0.18;
  depth = floor(clamp(depth, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
  vec3 shallow = vec3(0.12, 0.52, 0.5);
  vec3 deep = vec3(0.01, 0.1, 0.17);
  vec3 col = mix(shallow, deep, depth);
  // the water's own colour follows the ambient light, so it goes dark at night
  col *= clamp(dot(uSkyAmb, vec3(0.3, 0.55, 0.15)) / 0.6, 0.1, 1.0);

  // soft sky reflection, stronger at grazing angles
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  vec3 sky = mix(uHorizon, uZenith, 0.3);
  col = mix(col, sky, 0.08 + fres * 0.4);

  // toon sun glint
  vec3 R = reflect(-normalize(uSunDir), N);
  // broken into sparkles so it reads as light on ripples, not a patch
  float spec = pow(max(dot(R, V), 0.0), 300.0) * step(0.78, vnoise(vWorld.xz * 7.0 + vec2(t * 0.9, -t * 0.6)));
  col += mix(uSunColor, vec3(1.0), 0.5) * step(0.5, spec) * 0.9;

  // the sunset catches the water
  float streak = smoothstep(0.75, 1.0, dot(normalize(vec2(uSunDir.x, uSunDir.z) + 1e-4), normalize(vWorld.xz - cameraPosition.xz + 1e-4)));
  vec3 orange = vec3(1.1, 0.3, 0.06);
  float shimmer = vnoise(vec2(vWorld.x * 0.6, vWorld.z * 2.5 + t * 0.6));
  col = mix(col, orange * (0.6 + shimmer * 0.9), uGlow * (0.35 + 0.55 * streak) * (1.0 - uGather));

  // water → fire: a noise dissolve that turns the hottest highlights into flame
  float burn = 0.0;
  if (uBurn > 0.001) {
    float gatherR = mix(60.0, 0.0, uGather);
    float nearFire = 1.0 - smoothstep(gatherR - 6.0, gatherR, length(vWorld.xz - uFirePos.xz));
    float n = fbm(vWorld.xz * 0.32 + vec2(0.0, -t * 1.1)) + shimmer * 0.25;
    float th = 1.15 - uBurn * 0.85;
    burn = step(th, n + streak * 0.2) * nearFire;
    float hot = step(th + 0.12, n + streak * 0.2) * burn;
    col = mix(col, vec3(1.5, 0.32, 0.05), burn);
    col = mix(col, vec3(2.0, 0.95, 0.18), hot);
  }

  // the campfire's warm reflection at night
  float fd = length(vWorld.xz - uFirePos.xz);
  col += vec3(1.0, 0.45, 0.15) * uFireIntensity * 0.35 / (1.0 + fd * fd * 0.02) * (0.5 + fres);

  // ripples + a foam ring where the water meets the bank
  float ang = atan(vLocal.y, vLocal.x);
  float edge = 0.965 + 0.012 * sin(ang * 13.0 + t * 1.3) + 0.01 * sin(ang * 7.0 - t * 0.9);
  float foam = step(edge, r) * (1.0 - step(edge + 0.06, r));
  col = mix(col, vec3(0.92, 0.97, 1.0) * (0.35 + uSunColor * 0.5 + uFireIntensity * 0.1), max(foam * 0.85, step(0.45, rings) * 0.75));

  float alpha = mix(0.62, 0.9, depth);
  alpha = max(alpha, max(burn, foam));
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}`

interface Koi { parts: ReturnType<typeof makeKoi>; school: number; lag: number; offset: Vector3 }
interface Pad { mesh: Group; base: Vector3; phase: number }

/** The koi pond: water, lily pads (incl. one per work role), lotus, koi, and the sunset that burns. */
export class Pond implements WorldModule {
  range: [number, number] = [0.4, 1]
  group = new Group()
  built = false
  /** Live world positions above each work pad, for the HTML role cards. */
  readonly padAnchors: Vector3[] = roles.map(() => new Vector3())
  private water!: Mesh
  private waterMat!: ShaderMaterial
  private ripples = Array.from({ length: RIPPLES }, () => new Vector4(0, 0, -100, 0))
  private rippleIdx = 0
  private lastRipple = new Vector3(0, -100, 0)
  private lastRippleT = 0
  private nextKoiRipple = 2
  private koi: Koi[] = []
  private decor: Pad[] = []
  private workPads: Group[] = []
  private flames!: InstancedMesh
  private flameBase: Vector3[] = []
  private embers!: Points
  private emberMat!: ShaderMaterial
  private m = new Matrix4()
  private q = new Quaternion()
  private s = new Vector3()
  private v = new Vector3()
  private focusLook = new Vector3()

  build(w: World) {
    const r = rng(88)
    this.waterMat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog]),
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
    })
    Object.assign(this.waterMat.uniforms, {
      uTime: G.uTime,
      uR: { value: POND_R },
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uSunDir: G.uSunDir,
      uSunColor: G.uSunColor,
      uRipples: { value: this.ripples },
      uGlow: { value: 0 },
      uBurn: { value: 0 },
      uGather: { value: 0 },
      uFirePos: { value: FIRE },
      uFireIntensity: G.uFireIntensity,
      uSkyAmb: G.uSkyAmb,
    })
    this.water = new Mesh(new CircleGeometry(POND_R + 2.5, 96, 0, Math.PI * 2), this.waterMat)
    this.water.rotation.x = -Math.PI / 2
    this.water.position.set(POND.x, WATER_Y, POND.z)
    this.water.renderOrder = 2
    this.group.add(this.water)

    // the islet where the bird lands
    const islet = new Group()
    const rock = toon('#8c877c', { rim: 0.6 })
    for (const [x, z, k, h] of [[0, 0, 1.0, 1], [0.7, 0.4, 0.6, 0.7], [-0.5, 0.5, 0.55, 0.6]] as const) {
      const m = new Mesh(flat(new DodecahedronGeometry(k, 0)), rock)
      m.scale.set(1.2, h * 0.75, 1)
      m.position.set(x, 0, z)
      islet.add(m)
    }
    const moss = new Mesh(paint(flat(new DodecahedronGeometry(0.7, 0)).scale(1.2, 0.25, 1), '#6f9a3c'), toon('#ffffff', { vertexColors: true }))
    moss.position.y = 0.6
    islet.add(moss)
    islet.position.set(ISLET.x, ISLET_TOP - 0.82, ISLET.z)
    this.group.add(islet)

    // decorative lily pads + lotus
    const padMat = toon('#ffffff', { vertexColors: true, rim: 0.7 })
    for (let i = 0; i < 18; i++) {
      let x = 0, z = 0
      for (let tries = 0; tries < 30; tries++) {
        const a = r() * Math.PI * 2, d = range(r, 4, POND_R - 3)
        x = POND.x + Math.cos(a) * d
        z = POND.z + Math.sin(a) * d
        // keep the work pads' lanes and the islet clear
        const clear = this.lanes(w).every((l) => Math.hypot(x - l.x, z - l.z) > 3.6)
        if (clear && Math.hypot(x - ISLET.x, z - ISLET.z) > 2.5) break
      }
      const g = new Group()
      const pad = new Mesh(lilyPadGeometry(range(r, 0.6, 1.15), 500 + i), padMat)
      pad.rotation.y = r() * 6.28
      g.add(pad)
      if (i % 4 === 0) {
        const lotus = makeLotus(600 + i)
        lotus.scale.setScalar(range(r, 0.8, 1.1))
        lotus.position.y = 0.03
        g.add(lotus)
      }
      const base = new Vector3(x, WATER_Y + 0.03, z)
      g.position.copy(base)
      this.decor.push({ mesh: g, base, phase: r() * 6.28 })
      this.group.add(g)
    }

    // one big pad per role
    roles.forEach((_, i) => {
      const g = new Group()
      const pad = new Mesh(lilyPadGeometry(1.35, 700 + i), padMat)
      pad.rotation.y = r() * 6.28
      g.add(pad)
      const lotus = makeLotus(800 + i)
      lotus.position.set(-0.55, 0.03, -0.45)
      lotus.scale.setScalar(0.8)
      g.add(lotus)
      this.workPads.push(g)
      this.group.add(g)
    })

    // koi in two loose schools
    for (let i = 0; i < 8; i++) {
      const parts = makeKoi(40 + i)
      parts.root.scale.setScalar(range(r, 0.8, 1.15))
      this.group.add(parts.root)
      this.koi.push({ parts, school: i % 2, lag: Math.floor(i / 2) * 0.9 + r() * 0.3, offset: new Vector3(range(r, -1.4, 1.4), 0, range(r, -1.4, 1.4)) })
    }

    // sunset fire: flame tongues on the water and rising embers
    this.flames = makeFlames(FLAMES, 3)
    ;(this.flames.material as ShaderMaterial).uniforms.uHeat!.value = 0.6
    for (let i = 0; i < FLAMES; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (POND_R - 3)
      this.flameBase.push(new Vector3(POND.x + Math.cos(a) * d, WATER_Y, POND.z + Math.sin(a) * d))
    }
    this.group.add(this.flames)
    this.buildEmbers(r)
  }

  private laneCache: Vector3[] | null = null
  /**
   * Each work pad keeps its own lane at a different depth from the camera, alternating left and
   * right, so the pads never drift into each other however many roles there are.
   */
  lanes(w: World) {
    if (this.laneCache) return this.laneCache
    const cam = new Vector3(), look = new Vector3()
    w.rig.sample(0.74, cam, look)
    const fwd = look.sub(cam).setY(0).normalize()
    const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0))
    const n = roles.length
    // tighter lanes on narrow screens so pads (and their lettering) stay in view
    const side = [-3.4, 3.0, -1.4, 3.8, -3.0].map((x) => x * (1 - 0.7 * w.rig.narrow))
    this.laneCache = roles.map((_, i) => {
      const d = 11.5 + (n > 1 ? i / (n - 1) : 0.5) * 15
      return new Vector3(cam.x, WATER_Y + 0.03, cam.z).addScaledVector(fwd, d).addScaledVector(right, side[i % side.length]!)
    })
    return this.laneCache
  }

  /** Resting position of role i's pad. */
  padBase(w: World, i: number) {
    return this.lanes(w)[i]!
  }

  private buildEmbers(r: () => number) {
    const pos = new Float32Array(EMBERS * 3)
    const seed = new Float32Array(EMBERS * 4)
    for (let i = 0; i < EMBERS; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (POND_R - 2)
      pos[i * 3] = POND.x + Math.cos(a) * d
      pos[i * 3 + 1] = WATER_Y
      pos[i * 3 + 2] = POND.z + Math.sin(a) * d
      seed.set([r(), range(r, 0.6, 1.4), range(r, 2, 6), r()], i * 4)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new BufferAttribute(seed, 4))
    this.emberMat = new ShaderMaterial({
      uniforms: { uTime: G.uTime, uAmount: { value: 0 }, uGather: { value: 0 }, uFire: { value: FIRE }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed; // phase, speed, height, wobble
        uniform float uTime;
        uniform float uGather;
        uniform vec3 uFire;
        uniform float uPx;
        varying float vA;
        void main() {
          float life = fract(uTime * 0.25 * aSeed.y + aSeed.x);
          vec3 p = position;
          p.xz = mix(p.xz, uFire.xz + (p.xz - uFire.xz) * 0.04, uGather * uGather);
          p.y += life * aSeed.z * (1.0 - uGather * 0.5);
          p.x += sin(uTime * 2.0 + aSeed.w * 20.0) * 0.25 * life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.0 + 2.5 * (1.0 - life)) * 6.0 / max(1.0, -mv.z * 0.12);
          vA = sin(life * 3.14159);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * vA * uAmount;
          gl_FragColor = vec4(vec3(3.0, 1.2, 0.3) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    })
    this.embers = new Points(geo, this.emberMat)
    this.embers.frustumCulled = false
    this.group.add(this.embers)
  }

  setQuality(q: Quality) {
    this.embers.geometry.setDrawRange(0, Math.round(EMBERS * q.particles))
  }

  resize() {
    this.emberMat.uniforms.uPx!.value = Math.min(devicePixelRatio || 1, 2)
    this.laneCache = null
  }

  update(w: World) {
    const wp = state.wp
    const t = state.time
    const dt = state.dt
    const motion = state.reduced ? 0 : 1
    const u = this.waterMat.uniforms
    u.uZenith!.value.copy(w.atmo.zenith)
    u.uHorizon!.value.copy(w.atmo.horizon)

    // sunset → burn → gather into the campfire
    const glow = smooth(wp, T.sunset[0], T.sunset[1])
    const burn = smooth(wp, T.burn[0], T.burn[1])
    const gather = smooth(wp, T.gather[0], T.gather[1])
    u.uGlow!.value = glow
    u.uBurn!.value = burn
    u.uGather!.value = gather
    this.emberMat.uniforms.uAmount!.value = burn * (1 - smooth(gather, 0.8, 1))
    this.emberMat.uniforms.uGather!.value = gather
    this.embers.visible = burn > 0.001 && gather < 0.999

    const fl = burn * (1 - smooth(gather, 0.85, 1))
    this.flames.visible = fl > 0.001
    if (this.flames.visible) {
      for (let i = 0; i < FLAMES; i++) {
        const b = this.flameBase[i]!
        const own = smooth(burn, (i / FLAMES) * 0.6, (i / FLAMES) * 0.6 + 0.4)
        const k = gather * gather
        this.v.lerpVectors(b, FIRE, k)
        this.v.y = WATER_Y + k * 0.25
        const h = own * (1.1 + Math.sin(i * 7.7) * 0.5) * (1 - k * 0.7) * (0.8 + 0.2 * Math.sin(t * 9 + i))
        this.s.set(h * 0.55, h, 1)
        this.flames.setMatrixAt(i, this.m.compose(this.v, this.q.identity(), this.s))
      }
      this.flames.instanceMatrix.needsUpdate = true
    }

    // the work pads idle in their own lanes; the camera eases toward whichever is in focus
    let total = 0
    this.focusLook.set(0, 0, 0)
    roles.forEach((_, i) => {
      const lane = this.lanes(w)[i]!
      const g = this.workPads[i]!
      g.position.set(
        lane.x + Math.sin(t * 0.12 + i * 2) * 0.45 * motion,
        lane.y + Math.sin(t * 1.1 + i) * 0.02 * motion,
        lane.z + Math.cos(t * 0.1 + i * 2) * 0.35 * motion,
      )
      g.rotation.y = t * 0.05 * motion + i
      this.padAnchors[i]!.copy(g.position).add(this.v.set(0, 0.35, 0))
      const f = this.focus(i)
      total += f
      this.focusLook.addScaledVector(lane, f)
    })
    if (total > 0.001 && !state.reduced) {
      const o = w.rig.override
      this.focusLook.divideScalar(total)
      w.rig.sample(wp, o.pos, o.look)
      // drift a little toward the pad and look at it
      o.pos.x += (this.focusLook.x - o.pos.x) * 0.08
      o.look.lerp(this.v.copy(this.focusLook).setY(this.focusLook.y + 1.6), 0.45)
      o.weight = 0.7 * Math.min(1, total) * (1 - 0.6 * w.rig.narrow)
    }

    for (const p of this.decor) {
      p.mesh.position.set(p.base.x + Math.sin(t * 0.13 + p.phase) * 0.3 * motion, p.base.y + Math.sin(t * 1.3 + p.phase) * 0.015 * motion, p.base.z)
      p.mesh.rotation.y = Math.sin(t * 0.1 + p.phase) * 0.4 * motion
    }

    this.updateKoi(t, motion)
    this.updateRipples(t, dt)
  }

  private updateKoi(t: number, motion: number) {
    const swim = t * motion
    for (const k of this.koi) {
      const tt = swim * 0.16 - k.lag * 0.16 + k.school * 3.1
      const path = (time: number, out: Vector3) =>
        out.set(
          POND.x + Math.cos(time) * (11 + Math.sin(time * 0.7) * 3) * (k.school ? 1 : 0.8),
          WATER_Y - 0.42,
          POND.z + Math.sin(time * (k.school ? 1 : -1)) * (8 + Math.cos(time * 1.3) * 2.5),
        )
      path(tt, k.parts.root.position).add(k.offset)
      path(tt + 0.03, this.v).add(k.offset)
      k.parts.root.lookAt(this.v)
      k.parts.root.rotation.z += Math.sin(t * 2.4 + k.lag) * 0.05
      k.parts.tail.rotation.y = Math.sin(t * 6 + k.lag * 3) * 0.45 * (motion || 0.2)
    }
  }

  private addRipple(x: number, z: number, strength: number, t: number) {
    const rp = this.ripples[this.rippleIdx]!
    rp.set(x, z, t, strength)
    this.rippleIdx = (this.rippleIdx + 1) % RIPPLES
  }

  private updateRipples(t: number, _dt: number) {
    // the cursor leaves ripples on the water
    if (G.uPointerStrength.value > 0.3 && state.wp > 0.66 && state.wp < 0.84) {
      const o = G.uPointerRayO.value, d = G.uPointerRayD.value
      if (d.y < -0.01) {
        const k = (WATER_Y - o.y) / d.y
        const x = o.x + d.x * k, z = o.z + d.z * k
        if (Math.hypot(x - POND.x, z - POND.z) < POND_R - 1) {
          const moved = Math.hypot(x - this.lastRipple.x, z - this.lastRipple.z)
          if (moved > 1.1 || (moved > 0.15 && t - this.lastRippleT > 0.5)) {
            this.addRipple(x, z, 1, t)
            this.lastRipple.set(x, 0, z)
            this.lastRippleT = t
          }
        }
      }
    }
    // koi break the surface now and then
    if (t > this.nextKoiRipple && !state.reduced) {
      this.nextKoiRipple = t + 2.5 + Math.random() * 3
      const k = this.koi[Math.floor(Math.random() * this.koi.length)]!
      this.addRipple(k.parts.root.position.x, k.parts.root.position.z, 0.6, t)
    }
  }

  /** 0..1 focus of role i (for the HTML cards). */
  focus(i: number) {
    const [a, b] = roleSlot(i, roles.length)
    const pad = (b - a) * 0.12
    return bell(state.p, a - pad, a + pad, b - pad, b + pad)
  }
}
