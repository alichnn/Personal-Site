import { BufferAttribute, BufferGeometry, Group, MathUtils, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { G, state } from '../core/state'
import { groundHeight } from '../core/layout'
import { T, smooth } from '../core/timeline'
import { rng, range } from '../core/util'

const MAX = 220

interface Seed {
  start: Vector3
  end: Vector3
  /** Camera path position when this seed starts / finishes falling. */
  camA: Vector3
  camB: Vector3
  a: number
  b: number
  phase: number
  floater: boolean
}

/** Stars detach, fall with the camera, and become dandelion seeds that settle on the meadow. */
export class Seeds implements WorldModule {
  range: [number, number] = [0.27, 0.68]
  group = new Group()
  built = false
  private seeds: Seed[] = []
  private points!: Points
  private mat!: ShaderMaterial
  private pos!: BufferAttribute
  private morph!: BufferAttribute
  private count = MAX
  private off = new Vector3()
  private tmp = new Vector3()
  private camNow = new Vector3()
  private look = new Vector3()

  build(w: World) {
    const r = rng(404)
    const L = T.seeds[1] - T.seeds[0]
    const nightPos = new Vector3(), nightLook = new Vector3()
    w.rig.sample(0.375, nightPos, nightLook)
    const fwd = nightLook.clone().sub(nightPos).normalize()
    const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
    const up = new Vector3().crossVectors(right, fwd)

    const signPos = new Vector3(), signLook = new Vector3()
    w.rig.sample(0.56, signPos, signLook)
    const gFwd = signLook.clone().sub(signPos).setY(0).normalize()
    const gRight = new Vector3().crossVectors(gFwd, new Vector3(0, 1, 0)).normalize()
    const tmpLook = new Vector3()

    for (let i = 0; i < MAX; i++) {
      const dist = range(r, 70, 200)
      const start = nightPos.clone()
        .addScaledVector(fwd, dist)
        .addScaledVector(right, range(r, -0.8, 0.8) * dist)
        .addScaledVector(up, range(r, -0.25, 0.45) * dist)
      const floater = r() < 0.16
      let d = 0, lat = 0
      // keep the line of sight to the signpost clear
      do {
        d = floater ? range(r, 3, 12) : range(r, 3, 26)
        lat = range(r, -0.65, 0.65) * d
      } while (d < 12 && Math.abs(lat) < 2.6)
      const end = signPos.clone().addScaledVector(gFwd, d).addScaledVector(gRight, lat)
      end.y = groundHeight(end.x, end.z) + (floater ? range(r, 1.2, 3.4) : range(r, 0.25, 0.6))
      const a = T.seeds[0] + r() * 0.35 * L
      const b = a + L * range(r, 0.58, 0.65)
      const camA = new Vector3(), camB = new Vector3()
      w.rig.sample(a, camA, tmpLook)
      w.rig.sample(b, camB, tmpLook)
      this.seeds.push({ start, end, camA, camB, a, b, phase: r() * Math.PI * 2, floater })
    }

    const geo = new BufferGeometry()
    this.pos = new BufferAttribute(new Float32Array(MAX * 3), 3)
    this.morph = new BufferAttribute(new Float32Array(MAX), 1)
    geo.setAttribute('position', this.pos)
    geo.setAttribute('aMorph', this.morph)
    geo.setAttribute('aRot', new BufferAttribute(Float32Array.from({ length: MAX }, () => range(r, -0.5, 0.5)), 1))
    geo.setAttribute('aPhase', new BufferAttribute(Float32Array.from({ length: MAX }, () => r()), 1))
    this.mat = new ShaderMaterial({
      uniforms: { uTime: G.uTime, uStars: G.uStars, uPx: { value: 1 }, uScale: { value: 800 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aMorph;
        attribute float aRot;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPx;
        uniform float uScale;
        varying float vMorph;
        varying float vRot;
        varying float vTw;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vMorph = aMorph;
          vRot = aRot + sin(uTime * 0.7 + aPhase * 6.28) * 0.15 * aMorph;
          vTw = 0.6 + 0.4 * sin(uTime * (0.8 + aPhase * 2.0) + aPhase * 6.28);
          float starSize = (2.4 + aPhase * 1.6) * uPx;
          float seedSize = 0.4 * uScale / max(-mv.z, 0.3);
          gl_PointSize = mix(starSize, seedSize, smoothstep(0.0, 1.0, aMorph));
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStars;
        uniform float uFade;
        varying float vMorph;
        varying float vRot;
        varying float vTw;
        void main() {
          vec2 uv = (gl_PointCoord - 0.5) * 2.0;
          uv.y = -uv.y;
          float c = cos(vRot), s = sin(vRot);
          uv = mat2(c, -s, s, c) * uv;

          // star
          float d = length(uv);
          float star = (1.0 - smoothstep(0.0, 0.35, d)) * 1.4 + pow(1.0 - clamp(d, 0.0, 1.0), 3.0) * 0.5;

          // dandelion seed: a fan of filaments with tufted tips, a stem, and the seed itself
          vec2 v = uv - vec2(0.0, 0.28);
          float r = length(v);
          float ang = atan(v.y, v.x);
          float stepA = 3.14159 / 9.0;
          float k = floor(ang / stepA + 0.5) * stepA;
          float fil = (1.0 - smoothstep(0.012, 0.04, abs(sin(ang - k)) * r)) * step(r, 0.6) * smoothstep(-0.1, 0.25, sin(ang));
          vec2 tipDir = vec2(cos(k), sin(k));
          float tip = (1.0 - smoothstep(0.0, 0.11, length(v - tipDir * 0.6))) * smoothstep(-0.1, 0.25, sin(k));
          float stem = (1.0 - smoothstep(0.012, 0.03, abs(uv.x))) * step(-0.56, uv.y) * step(uv.y, 0.28);
          vec2 e = (uv - vec2(0.0, -0.66)) / vec2(0.06, 0.13);
          float achene = 1.0 - smoothstep(0.8, 1.0, length(e));
          float seedA = clamp(fil * 0.85 + tip * 0.7 + stem * 0.9 + achene, 0.0, 1.0);
          vec3 seedCol = mix(vec3(1.0, 0.98, 0.93), vec3(0.55, 0.42, 0.3), achene);

          float m = smoothstep(0.15, 0.7, vMorph);
          float starA = star * uStars * vTw * (1.0 - m);
          float a = mix(starA, seedA, m) * uFade;
          if (a < 0.01) discard;
          vec3 col = mix(vec3(1.25, 1.22, 1.15), seedCol, m);
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      fog: false,
    })
    this.points = new Points(geo, this.mat)
    this.points.frustumCulled = false
    this.group.add(this.points)
  }

  setQuality(q: Quality) {
    this.count = Math.min(MAX, q.seeds)
    this.points.geometry.setDrawRange(0, this.count)
  }

  resize(w: World) {
    this.mat.uniforms.uPx!.value = Math.min(devicePixelRatio || 1, 2)
    const h = innerHeight * Math.min(devicePixelRatio || 1, w.quality.dpr)
    this.mat.uniforms.uScale!.value = h / (2 * Math.tan(MathUtils.degToRad(50 / 2)))
  }

  update(w: World) {
    const wp = state.wp
    const t = state.time
    const motion = state.reduced ? 0 : 1
    const cam = this.camNow
    w.rig.sample(wp, cam, this.look)
    for (let i = 0; i < this.count; i++) {
      const s = this.seeds[i]!
      const k = smooth(wp, s.a, s.b)
      let x: number, y: number, z: number
      if (k <= 0) {
        x = s.start.x; y = s.start.y; z = s.start.z
      } else if (k >= 1) {
        x = s.end.x; y = s.end.y; z = s.end.z
        if (s.floater) {
          x += Math.sin(t * 0.31 + s.phase) * 0.6 * motion
          y += Math.sin(t * 0.47 + s.phase * 2) * 0.25 * motion
          z += Math.cos(t * 0.27 + s.phase) * 0.5 * motion
        }
      } else {
        // ride along with the camera, easing from the sky offset to the meadow offset
        const e = k * k * (3 - 2 * k)
        this.tmp.copy(s.end).sub(s.camB)
        this.off.copy(s.start).sub(s.camA).lerp(this.tmp, e)
        const sway = Math.sin(Math.PI * k)
        x = cam.x + this.off.x + Math.sin(k * 9 + s.phase) * 3 * sway
        y = cam.y + this.off.y
        z = cam.z + this.off.z + Math.cos(k * 7 + s.phase) * 3 * sway
      }
      this.pos.setXYZ(i, x, y, z)
      this.morph.setX(i, smooth(k, 0.15, 0.75))
    }
    this.pos.needsUpdate = true
    this.morph.needsUpdate = true
    this.mat.uniforms.uFade!.value = 1 - smooth(wp, 0.62, 0.67)
  }
}
