import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  type PointLight,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { G, state } from '../core/state'
import { FIRE, groundHeight } from '../core/layout'
import { T, smooth } from '../core/timeline'
import { rng, range } from '../core/util'
import { makeCampfireWood } from './models'
import { makeFlames } from './flame'

const EMBERS = 90
const FIREFLIES = 80

/** Campfire with flickering light, embers, and fireflies that rise into the stars at the end. */
export class Campfire implements WorldModule {
  range: [number, number] = [0.8, 1]
  group = new Group()
  built = false
  private light!: PointLight
  private flames!: InstancedMesh
  private flameSpec: { off: Vector3; w: number; h: number; ph: number }[] = []
  private embers!: Points
  private emberMat!: ShaderMaterial
  private flies!: Points
  private flyMat!: ShaderMaterial
  private base = new Vector3()
  private m = new Matrix4()
  private q = new Quaternion()
  private s = new Vector3()
  private v = new Vector3()
  private screen = { x: 0, y: 0 }

  build(w: World) {
    const r = rng(61)
    this.base.set(FIRE.x, groundHeight(FIRE.x, FIRE.z), FIRE.z)
    const wood = makeCampfireWood()
    wood.position.copy(this.base)
    this.group.add(wood)

    this.light = w.atmo.fireLight
    this.light.position.copy(this.base).add(new Vector3(0, 1.0, 0))
    G.uFirePos.value.copy(this.light.position)

    this.flames = makeFlames(6, 9)
    this.flameSpec = [
      { off: new Vector3(0, 0.12, 0), w: 0.95, h: 1.7, ph: 0 },
      { off: new Vector3(0.22, 0.1, 0.1), w: 0.6, h: 1.15, ph: 1.3 },
      { off: new Vector3(-0.2, 0.1, -0.08), w: 0.65, h: 1.25, ph: 2.1 },
      { off: new Vector3(0.05, 0.1, 0.24), w: 0.5, h: 0.95, ph: 3.7 },
      { off: new Vector3(-0.08, 0.1, -0.25), w: 0.5, h: 0.9, ph: 4.4 },
      { off: new Vector3(0.0, 0.2, 0.0), w: 0.45, h: 2.1, ph: 5.2 },
    ]
    this.group.add(this.flames)

    // embers drifting up from the fire
    const ePos = new Float32Array(EMBERS * 3)
    const eSeed = new Float32Array(EMBERS * 4)
    for (let i = 0; i < EMBERS; i++) {
      ePos.set([this.base.x + range(r, -0.3, 0.3), this.base.y + 0.4, this.base.z + range(r, -0.3, 0.3)], i * 3)
      eSeed.set([r(), range(r, 0.6, 1.4), range(r, 2.5, 5), r()], i * 4)
    }
    const eg = new BufferGeometry()
    eg.setAttribute('position', new BufferAttribute(ePos, 3))
    eg.setAttribute('aSeed', new BufferAttribute(eSeed, 4))
    this.emberMat = new ShaderMaterial({
      uniforms: { uTime: G.uTime, uAmount: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uPx;
        varying float vA;
        void main() {
          float life = fract(uTime * 0.3 * aSeed.y + aSeed.x);
          vec3 p = position;
          p.y += life * aSeed.z;
          p.x += sin(uTime * 1.7 + aSeed.w * 30.0) * 0.4 * life;
          p.z += cos(uTime * 1.3 + aSeed.w * 20.0) * 0.4 * life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.5 + 2.5 * (1.0 - life)) * 10.0 / max(1.0, -mv.z * 0.3);
          vA = sin(life * 3.14159) * (1.0 - life * 0.5);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * vA * uAmount;
          gl_FragColor = vec4(vec3(3.2, 1.3, 0.35) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    })
    this.embers = new Points(eg, this.emberMat)
    this.embers.frustumCulled = false
    this.group.add(this.embers)

    // fireflies around the clearing
    const fPos = new Float32Array(FIREFLIES * 3)
    const fSeed = new Float32Array(FIREFLIES * 4)
    for (let i = 0; i < FIREFLIES; i++) {
      const a = r() * Math.PI * 2, d = range(r, 2.5, 15)
      const x = this.base.x + Math.cos(a) * d - 4, z = this.base.z + Math.sin(a) * d * 0.8 + 2
      fPos.set([x, groundHeight(x, z) + range(r, 0.3, 2.4), z], i * 3)
      fSeed.set([r(), range(r, 0.5, 1.5), range(r, 14, 46), r()], i * 4)
    }
    const fg = new BufferGeometry()
    fg.setAttribute('position', new BufferAttribute(fPos, 3))
    fg.setAttribute('aSeed', new BufferAttribute(fSeed, 4))
    this.flyMat = new ShaderMaterial({
      uniforms: { uTime: G.uTime, uAmount: { value: 0 }, uRise: { value: 0 }, uPx: { value: 1 }, uMotion: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed; // phase, speed, rise height, blink
        uniform float uTime;
        uniform float uRise;
        uniform float uPx;
        uniform float uMotion;
        varying float vA;
        varying float vRise;
        void main() {
          float t = uTime * aSeed.y * uMotion + aSeed.x * 50.0;
          vec3 p = position + vec3(sin(t * 0.37) * 1.2 + sin(t * 0.91) * 0.4, sin(t * 0.53) * 0.5, cos(t * 0.29) * 1.2) * uMotion;
          float rise = uRise * uRise;
          p.y += rise * aSeed.z;
          // drift up and away over the pond, toward the constellation
          p.xz += vec2(sin(aSeed.w * 40.0) * 0.5, -1.2 - abs(cos(aSeed.w * 40.0)) * 0.4) * rise * aSeed.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float blink = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed.w * 2.0) * uMotion + aSeed.x * 20.0), 2.0);
          float near = 26.0 / max(1.0, -mv.z);
          gl_PointSize = uPx * mix(clamp(near * 3.0, 2.0, 14.0), 2.6, rise);
          vA = mix(blink, 0.7 + 0.3 * blink, rise);
          vRise = rise;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying float vA;
        varying float vRise;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float core = 1.0 - smoothstep(0.0, 0.35, d);
          float glow = pow(1.0 - d, 2.0) * 0.6;
          float a = (core + glow) * vA * uAmount;
          vec3 col = mix(vec3(1.9, 2.2, 0.55), vec3(1.6, 1.65, 1.8), vRise);
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    })
    this.flies = new Points(fg, this.flyMat)
    this.flies.frustumCulled = false
    this.group.add(this.flies)
  }

  setQuality(q: Quality) {
    this.embers.geometry.setDrawRange(0, Math.round(EMBERS * Math.max(0.5, q.particles)))
    this.flies.geometry.setDrawRange(0, Math.round(FIREFLIES * Math.max(0.45, q.particles)))
  }

  resize() {
    const px = Math.min(devicePixelRatio || 1, 2)
    this.emberMat.uniforms.uPx!.value = px
    this.flyMat.uniforms.uPx!.value = px
  }

  update(w: World) {
    const wp = state.wp
    const t = state.time
    const motion = state.reduced ? 0.25 : 1
    // the fire condenses out of the burning pond
    const ignite = smooth(wp, T.gather[0] + 0.006, T.gather[1])
    const flicker = 0.78 + (Math.sin(t * 13.1) * 0.09 + Math.sin(t * 7.3 + 1) * 0.08 + Math.sin(t * 23.7 + 2) * 0.05) * motion
    state.fireFlicker = ignite * flicker
    this.light.intensity = ignite * flicker * 26
    G.uFireIntensity.value = ignite * flicker
    G.uFirePos.value.copy(this.light.position)

    this.flames.visible = ignite > 0.001
    this.flameSpec.forEach((f, i) => {
      const pulse = 0.88 + 0.12 * Math.sin(t * (5 + i) + f.ph) * motion
      const h = f.h * ignite * pulse
      this.v.copy(this.base).add(f.off)
      this.s.set(f.w * ignite, h, 1)
      this.flames.setMatrixAt(i, this.m.compose(this.v, this.q, this.s))
    })
    this.flames.instanceMatrix.needsUpdate = true

    this.emberMat.uniforms.uAmount!.value = ignite * (state.reduced ? 0.4 : 1)
    const night = smooth(wp, 0.845, 0.87)
    this.flyMat.uniforms.uAmount!.value = night
    this.flyMat.uniforms.uMotion!.value = state.reduced ? 0.15 : 1
    this.flyMat.uniforms.uRise!.value = state.reduced ? 0 : smooth(wp, T.tilt[0], 1)
    this.flies.visible = night > 0.001

    // where the fire is on screen (the album cards catch its light)
    const vis = w.project(this.v.copy(this.base).setY(this.base.y + 0.8), this.screen)
    state.fireScreen.x = this.screen.x
    state.fireScreen.y = this.screen.y
    state.fireScreen.visible = vis && ignite > 0.01
  }
}
