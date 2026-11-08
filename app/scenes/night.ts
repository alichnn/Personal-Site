import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { G, state } from '../core/state'
import { NOISE } from '../core/glsl'
import { layoutConstellation, starDirs } from '../core/constellation'
import { bell, smooth } from '../core/timeline'
import { rng, range } from '../core/util'

const R = 900
const MAX_STARS = 3600

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aTint;
uniform float uTime;
uniform float uPx;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.6 + fract(aPhase * 7.13) * 2.2) + aPhase * 6.283));
  gl_PointSize = aSize * uPx * (0.75 + 0.25 * tw);
  // fade toward the horizon
  float elev = normalize(position).y;
  vAlpha = smoothstep(-0.02, 0.12, elev) * tw;
  vColor = aTint * (0.7 + aSize * 0.45);
}`

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.35, d);
  float glow = pow(1.0 - clamp(d, 0.0, 1.0), 3.0) * 0.5;
  float a = (core + glow) * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * (core * 1.4 + glow), a);
}`

/** Twinkling stars, shooting stars, aurora, and the AC constellation's stars. */
export class Night implements WorldModule {
  range: [number, number] = [0.2, 1]
  group = new Group()
  built = false
  private stars!: Points
  private starMat!: ShaderMaterial
  private cStars!: Points
  private cMat!: ShaderMaterial
  private aurora: Mesh[] = []
  private auroraMat!: ShaderMaterial
  private shooting: { mesh: Mesh; geo: BufferGeometry; t: number; dur: number; a: Vector3; b: Vector3; on: boolean }[] = []
  private nextShoot = 4
  private tmpH = new Vector3()
  private tmpT = new Vector3()
  private side = new Vector3()

  build() {
    const r = rng(31)
    const pos = new Float32Array(MAX_STARS * 3)
    const size = new Float32Array(MAX_STARS)
    const phase = new Float32Array(MAX_STARS)
    const tint = new Float32Array(MAX_STARS * 3)
    const warm = new Color('#ffe2c4'), cool = new Color('#cfe0ff'), white = new Color('#ffffff'), c = new Color()
    for (let i = 0; i < MAX_STARS; i++) {
      // uniform on the sphere, upper part only
      const y = range(r, -0.05, 1)
      const a = r() * Math.PI * 2
      const s = Math.sqrt(1 - y * y)
      pos[i * 3] = Math.cos(a) * s * R
      pos[i * 3 + 1] = y * R
      pos[i * 3 + 2] = Math.sin(a) * s * R
      size[i] = 1 + Math.pow(r(), 3.2) * 2.6
      phase[i] = r()
      const k = r()
      c.copy(white).lerp(k < 0.5 ? warm : cool, Math.abs(k - 0.5) * 1.4)
      tint[i * 3] = c.r
      tint[i * 3 + 1] = c.g
      tint[i * 3 + 2] = c.b
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new BufferAttribute(size, 1))
    geo.setAttribute('aPhase', new BufferAttribute(phase, 1))
    geo.setAttribute('aTint', new BufferAttribute(tint, 3))
    this.starMat = this.makeStarMaterial(1)
    this.stars = new Points(geo, this.starMat)
    this.stars.frustumCulled = false
    this.group.add(this.stars)

    // the constellation's stars: a touch bigger and bluer so they read as a set
    const n = starDirs.length
    const cg = new BufferGeometry()
    cg.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    cg.setAttribute('aSize', new BufferAttribute(new Float32Array(n).fill(4.6), 1))
    cg.setAttribute('aPhase', new BufferAttribute(Float32Array.from({ length: n }, () => r()), 1))
    cg.setAttribute('aTint', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [0.92, 0.96, 1.0][i % 3]!), 3))
    this.cMat = this.makeStarMaterial(0.35)
    this.cStars = new Points(cg, this.cMat)
    this.cStars.frustumCulled = false
    this.group.add(this.cStars)

    this.buildAurora()
    this.buildShootingStars()
  }

  private makeStarMaterial(twinkle: number) {
    return new ShaderMaterial({
      uniforms: { uTime: G.uTime, uPx: { value: 1 }, uOpacity: { value: 0 }, uTwinkle: { value: twinkle } },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    })
  }

  private buildAurora() {
    this.auroraMat = new ShaderMaterial({
      uniforms: { uTime: G.uTime, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aBand;
        varying vec2 vUv;
        varying float vBand;
        void main() {
          vUv = uv;
          vBand = aBand;
          float span = 1.9;
          float th = -1.5708 + (uv.x - 0.5) * span + aBand * 0.35;
          th += sin(uv.x * 9.0 + uTime * 0.07 + aBand * 3.0) * 0.03;
          float r = 840.0 - aBand * 30.0;
          float base = 18.0 + sin(uv.x * 5.0 + aBand * 2.0) * 10.0;
          float h = 90.0 + 60.0 * sin(uv.x * 3.1 + aBand * 1.7 + uTime * 0.03) + 30.0 * sin(uv.x * 11.0 - uTime * 0.05);
          vec3 p = vec3(cos(th) * r, base + uv.y * h, sin(th) * r);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vBand;
        ${NOISE}
        void main() {
          // clamp: interpolated uvs can overshoot 1.0 by an epsilon, and pow() of a negative is NaN
          vec2 uv = clamp(vUv, 0.0, 1.0);
          float rays = fbm(vec2(uv.x * 42.0 + vBand * 9.0, uTime * 0.05));
          rays = smoothstep(0.3, 0.8, rays);
          float vert = smoothstep(0.0, 0.12, uv.y) * pow(max(1.0 - uv.y, 0.0), 1.6);
          float edges = smoothstep(0.0, 0.15, uv.x) * (1.0 - smoothstep(0.85, 1.0, uv.x));
          vec3 green = vec3(0.25, 1.0, 0.62);
          vec3 violet = vec3(0.55, 0.3, 1.0);
          vec3 col = mix(green, violet, smoothstep(0.25, 0.9, uv.y) * 0.8 + vBand * 0.2);
          float a = vert * edges * (0.35 + 0.65 * rays) * uOpacity;
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    })
    for (let b = 0; b < 3; b++) {
      const g = new PlaneGeometry(1, 1, 140, 1)
      g.setAttribute('aBand', new BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(b / 2), 1))
      const m = new Mesh(g, this.auroraMat)
      m.frustumCulled = false
      m.renderOrder = -5
      this.aurora.push(m)
      this.group.add(m)
    }
  }

  private buildShootingStars() {
    for (let i = 0; i < 2; i++) {
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(new Float32Array(4 * 3), 3))
      geo.setAttribute('aHead', new BufferAttribute(new Float32Array([1, 1, 0, 0]), 1))
      geo.setIndex([0, 1, 2, 2, 1, 3])
      const mat = new ShaderMaterial({
        uniforms: { uFade: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aHead;
          varying float vHead;
          void main() { vHead = aHead; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uFade;
          varying float vHead;
          void main() {
            float a = pow(vHead, 2.2) * uFade;
            gl_FragColor = vec4(vec3(1.6, 1.55, 1.4) * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
      })
      const mesh = new Mesh(geo, mat)
      mesh.frustumCulled = false
      mesh.visible = false
      this.group.add(mesh)
      this.shooting.push({ mesh, geo, t: 0, dur: 1, a: new Vector3(), b: new Vector3(), on: false })
    }
  }

  setQuality(q: Quality) {
    this.stars.geometry.setDrawRange(0, Math.min(MAX_STARS, q.stars))
  }

  resize() {
    const px = Math.min(devicePixelRatio || 1, 2) * (innerHeight > 900 ? 1.15 : 1)
    this.starMat.uniforms.uPx!.value = px
    this.cMat.uniforms.uPx!.value = px
    layoutConstellation(innerWidth / innerHeight)
    const attr = this.cStars.geometry.getAttribute('position') as BufferAttribute
    starDirs.forEach((d, i) => attr.setXYZ(i, d.x * R * 0.98, d.y * R * 0.98, d.z * R * 0.98))
    attr.needsUpdate = true
  }

  update(w: World) {
    const stars = G.uStars.value
    if (stars < 0.002) {
      this.group.visible = false
      return
    }
    const wp = state.wp
    // the stars that become seeds leave the sky as dawn comes; the rest simply fade with the rig
    this.starMat.uniforms.uOpacity!.value = stars
    const constellation = Math.max(bell(wp, 0.29, 0.31, 0.4, 0.43), smooth(wp, 0.95, 0.975))
    this.cMat.uniforms.uOpacity!.value = stars * (0.35 + 0.65 * constellation)
    const auroraAmt = Math.max(bell(wp, 0.28, 0.33, 0.39, 0.43) * 1, smooth(wp, 0.9, 0.97) * 0.6)
    this.auroraMat.uniforms.uOpacity!.value = stars * auroraAmt * 0.32
    for (const m of this.aurora) m.visible = auroraAmt > 0.01

    this.updateShootingStars(w, stars)
  }

  private updateShootingStars(w: World, stars: number) {
    const dt = state.dt
    this.nextShoot -= dt
    if (this.nextShoot <= 0 && stars > 0.7 && !state.reduced) {
      this.nextShoot = 6 + Math.random() * 4
      const s = this.shooting.find((x) => !x.on)
      if (s) {
        // start somewhere in the upper part of the current view, streak down and across
        const fwd = w.camera.getWorldDirection(new Vector3())
        const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
        const up = new Vector3().crossVectors(right, fwd)
        const dir = Math.random() < 0.5 ? -1 : 1
        s.a.copy(fwd).addScaledVector(right, (Math.random() - 0.5) * 0.9).addScaledVector(up, 0.12 + Math.random() * 0.3).normalize()
        s.b.copy(s.a).addScaledVector(right, dir * (0.22 + Math.random() * 0.18)).addScaledVector(up, -0.12 - Math.random() * 0.1).normalize()
        s.t = 0
        s.dur = 0.7 + Math.random() * 0.5
        s.on = true
      }
    }
    for (const s of this.shooting) {
      if (!s.on) {
        s.mesh.visible = false
        continue
      }
      s.t += dt / s.dur
      if (s.t >= 1.35) {
        s.on = false
        continue
      }
      s.mesh.visible = true
      const head = Math.min(1, s.t)
      const tail = Math.max(0, s.t - 0.35)
      this.tmpH.lerpVectors(s.a, s.b, head).normalize().multiplyScalar(R * 0.9)
      this.tmpT.lerpVectors(s.a, s.b, tail).normalize().multiplyScalar(R * 0.9)
      this.side.subVectors(this.tmpH, this.tmpT).cross(this.tmpH).normalize().multiplyScalar(1.6)
      const p = s.geo.getAttribute('position') as BufferAttribute
      p.setXYZ(0, this.tmpH.x + this.side.x, this.tmpH.y + this.side.y, this.tmpH.z + this.side.z)
      p.setXYZ(1, this.tmpH.x - this.side.x, this.tmpH.y - this.side.y, this.tmpH.z - this.side.z)
      p.setXYZ(2, this.tmpT.x, this.tmpT.y, this.tmpT.z)
      p.setXYZ(3, this.tmpT.x, this.tmpT.y, this.tmpT.z)
      p.needsUpdate = true
      ;(s.mesh.material as ShaderMaterial).uniforms.uFade!.value = stars * Math.min(1, s.t * 6) * (1 - smooth(s.t, 0.85, 1.35))
    }
  }

  afterCamera(w: World) {
    this.group.position.copy(w.camera.position)
  }
}
