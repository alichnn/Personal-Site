import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { BURST_Z, SKY_Y } from '../core/layout'
import { G, state } from '../core/state'
import { bell, smooth } from '../core/timeline'
import { rng, range } from '../core/util'
import { cloudGeometry, cloudMaterial } from './cloudkit'

interface Spot {
  pos: Vector3
  scale: number
  /** Always kept, whatever the quality tier (the walls the story depends on). */
  core: boolean
}

/** The opening cloud bank, the corridor of cloud layers, and the burst into open sky. */
export class Clouds implements WorldModule {
  range: [number, number] = [0, 0.47]
  group = new Group()
  built = false
  /** 0..1 white-out fog from being inside a cloud wall (read by the sky). */
  wallFog = 0
  private meshes: { mesh: InstancedMesh; core: number; extra: number }[] = []
  private wisps!: Points
  private wispMat!: ShaderMaterial

  build() {
    const r = rng(2024)
    const spots: Spot[] = []
    const add = (x: number, y: number, z: number, scale: number, core = false) =>
      spots.push({ pos: new Vector3(x, y, z), scale, core })

    // the thick bank the visitor starts inside (and the loader pushes into)
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = range(r, 9, 60)
      add(Math.cos(a) * d, SKY_Y + Math.sin(a) * d * 0.55, range(r, 470, 660), range(r, 1.6, 3), i < 14)
    }
    // layers the camera streams through
    // each layer leaves a gap for the camera, so blue sky flashes between the walls of white
    for (const [li, wz] of [400, 300, 205].entries()) {
      const gap = (li % 2 ? 1 : -1) * range(r, 4, 14)
      for (let i = 0; i < 7; i++) {
        let x = range(r, -80, 80)
        if (Math.abs(x - gap) < 16) x += Math.sign(x - gap || 1) * 18
        add(x, SKY_Y + range(r, -30, 26), wz + range(r, -18, 18), range(r, 1.3, 2.4), i < 3)
      }
      // one cloud right on the path to punch through
      if (li % 2 === 0) add(gap * -0.5, SKY_Y + range(r, -3, 3), wz, 1.6, true)
    }
    // the corridor walls on either side
    for (let i = 0; i < 30; i++) {
      const side = r() < 0.5 ? -1 : 1
      add(side * range(r, 32, 140), SKY_Y + range(r, -50, 40), range(r, 140, 560), range(r, 1.5, 3.2))
    }
    // the final wall: dense, wide, punched through at the burst
    for (let gx = -5; gx <= 5; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        add(gx * 24 + range(r, -6, 6), SKY_Y + gy * 18 + range(r, -5, 5), BURST_Z + range(r, -6, 8), range(r, 2.4, 3.4), true)
      }
    }
    // clouds drifting around the hero and the people/night sky
    for (let i = 0; i < 28; i++) {
      const side = r() < 0.5 ? -1 : 1
      const y = r() < 0.75 ? range(r, -60, -24) : range(r, 34, 60)
      add(side * range(r, 34, 160), SKY_Y + y, range(r, -260, 80), range(r, 1.8, 3.6), i < 10)
    }

    const templates = [11, 12, 13, 14, 15].map((s) => cloudGeometry(s, 2))
    const mat = cloudMaterial({ push: 1.4, fadeNear: 3, fadeFar: 16 })
    const buckets: Spot[][] = templates.map(() => [])
    spots.forEach((s, i) => buckets[i % templates.length]!.push(s))
    const q = new Quaternion(), up = new Vector3(0, 1, 0), sc = new Vector3(), m = new Matrix4()
    templates.forEach((geo, i) => {
      // core spots first so lower tiers drop only the optional ones
      const list = buckets[i]!.sort((a, b) => Number(b.core) - Number(a.core))
      const mesh = new InstancedMesh(geo, mat, list.length)
      list.forEach((s, j) => {
        q.setFromAxisAngle(up, r() * Math.PI * 2)
        sc.set(s.scale, s.scale * range(r, 0.75, 1), s.scale)
        mesh.setMatrixAt(j, m.compose(s.pos, q, sc))
      })
      mesh.computeBoundingSphere()
      const core = list.filter((s) => s.core).length
      this.meshes.push({ mesh, core, extra: list.length - core })
      this.group.add(mesh)
    })

    this.buildWisps(r)
  }

  /** Torn cloud wisps just past the final wall; the camera tears through them at the burst. */
  private buildWisps(r: () => number) {
    const n = 220
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = range(r, 1.5, 16)
      pos[i * 3] = Math.cos(a) * d
      pos[i * 3 + 1] = SKY_Y + Math.sin(a) * d * 0.7
      pos[i * 3 + 2] = BURST_Z - range(r, 0, 70)
      size[i] = range(r, 0.6, 2.2)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new BufferAttribute(size, 1))
    this.wispMat = new ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uScale;
        varying float vFade;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(-mv.z, 0.5);
          vFade = smoothstep(0.5, 4.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vFade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = (1.0 - smoothstep(0.25, 0.5, d)) * 0.55 + (1.0 - smoothstep(0.0, 0.22, d)) * 0.25;
          gl_FragColor = vec4(vec3(1.0), a * uOpacity * vFade);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    })
    this.wisps = new Points(geo, this.wispMat)
    this.wisps.frustumCulled = false
    this.group.add(this.wisps)
  }

  setQuality(q: Quality) {
    for (const { mesh, core, extra } of this.meshes) mesh.count = core + Math.round(extra * q.clouds)
    this.wisps.geometry.setDrawRange(0, Math.round(220 * Math.max(0.4, q.particles)))
  }

  resize() {
    this.wispMat.uniforms.uScale!.value = innerHeight * 0.9
  }

  update(w: World) {
    const dt = state.dt
    const speed = Math.abs(state.speed)
    const air = 1 - smooth(state.wp, 0.12, 0.2)
    // wind: drift quickens with scroll speed, settles when scrolling stops
    G.uGust.value += (Math.min(1, speed / 2.5) - G.uGust.value) * (1 - Math.exp(-3 * dt))
    G.uWind.value += dt * (0.35 + G.uGust.value * 2.6)
    w.rig.shake = state.reduced ? 0 : G.uGust.value * air * 0.9

    // signature moment #1: the burst through the final wall
    const z = w.camera.position.z
    const through = bell(z, BURST_Z + 22, BURST_Z + 6, BURST_Z - 4, BURST_Z - 26)
    const exit = bell(z, BURST_Z + 2, BURST_Z - 6, BURST_Z - 14, BURST_Z - 40)
    w.flash = state.reduced ? 0 : exit * 0.55
    w.rig.fovKick = state.reduced ? 0 : exit * 9
    this.wispMat.uniforms.uOpacity!.value = Math.max(through, exit) * 0.9
    this.wisps.visible = !state.reduced

    // thick white inside the opening bank and the walls
    const bank = smooth(z, 470, 540)
    const layers = [400, 300, 205].reduce((acc, wz) => Math.max(acc, bell(z, wz + 16, wz + 4, wz - 4, wz - 16) * 0.55), 0)
    this.wallFog = Math.max(bank, layers, through * 0.95)
  }
}
