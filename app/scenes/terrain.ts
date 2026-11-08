import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { G, state } from '../core/state'
import { FIRE, POND, POND_R, SIGN, groundHeight } from '../core/layout'
import { NOISE, TOON_BANDS } from '../core/glsl'
import { toon } from '../core/toon'
import { blob, flat, noise3, rng, range, type Rand } from '../core/util'
import { smooth } from '../core/timeline'
import { cloudGeometry, cloudMaterial } from './cloudkit'

const CENTER = new Vector3(0, 0, -252)

const GRASS_VERT = /* glsl */ `
uniform float uTime;
uniform float uGust;
uniform vec3 uPointerGround;
uniform float uPointerStrength;
varying float vH;
varying vec3 vColor;
varying vec3 vWorld;
${NOISE}
#include <common>
#include <fog_pars_vertex>
void main() {
  float h = position.y;
  vec4 base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  // a wind field of travelling gusts
  float w = sin(base.x * 0.31 + uTime * 1.7) * 0.45
          + sin(base.z * 0.23 + base.x * 0.07 + uTime * 1.15) * 0.35
          + (vnoise(base.xz * 0.06 + vec2(uTime * 0.35, 0.0)) - 0.5) * 1.2;
  w *= 0.3 + uGust * 0.9;
  vec2 bend = vec2(0.85, 0.5) * w * 0.38;
  // part around the cursor
  vec2 d = base.xz - uPointerGround.xz;
  float dist = length(d);
  bend += (d / max(dist, 1e-3)) * (1.0 - smoothstep(0.0, 2.4, dist)) * uPointerStrength * 0.75;
  float tall = length(instanceMatrix[1].xyz);
  float k = h * h * tall;
  wp.xz += bend * k;
  wp.y -= dot(bend, bend) * k * 0.35;
  vH = h;
  vColor = instanceColor;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const GRASS_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmb;
uniform vec3 uFirePos;
uniform vec3 uFireColor;
uniform float uFireIntensity;
varying float vH;
varying vec3 vColor;
varying vec3 vWorld;
${TOON_BANDS}
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 base = vColor * mix(0.5, 1.12, vH);
  float sunUp = smoothstep(-0.05, 0.2, uSunDir.y);
  vec3 light = uSkyAmb * 1.35 + uSunColor * 0.85 * sunUp * toonBand(0.35 + vH * 0.65);
  vec3 toF = uFirePos - vWorld;
  float fl = uFireIntensity / (1.0 + dot(toF, toF) * 0.05);
  fl = floor(clamp(fl, 0.0, 1.5) * 4.0) / 4.0;
  vec3 col = base * (light + uFireColor * fl * 1.6);
  col += uSunColor * pow(vH, 3.0) * 0.08 * sunUp;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`

/** Ground, grass, trees, bushes, rocks and the day sky's distant cumulus. */
export class Terrain implements WorldModule {
  range: [number, number] = [0.38, 1]
  group = new Group()
  built = false
  private grass!: InstancedMesh
  private grassAlloc = 0
  private farClouds = new Group()

  build(w: World) {
    const r = rng(9)
    this.buildGround()
    this.buildGrass(r, w.quality.grass)
    this.buildTrees(r)
    this.buildRocksAndBushes(r)
    this.buildFarClouds(r)
  }

  private buildGround() {
    // A warped grid: ~1.6 units per cell near the meadow and pond, stretching out to the hills.
    const N = 200
    const geo = new PlaneGeometry(2, 2, N, N)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.getAttribute('position') as BufferAttribute
    const A = 160, B = 1240
    const warp = (u: number) => A * u + B * u * u * u
    for (let i = 0; i < pos.count; i++) {
      const x = warp(pos.getX(i)) + CENTER.x
      const z = warp(pos.getZ(i)) + CENTER.z
      pos.setXYZ(i, x, groundHeight(x, z), z)
    }
    const g = flat(geo)
    const p = g.getAttribute('position') as BufferAttribute
    const col = new Float32Array(p.count * 3)
    const meadow = new Color('#79b043'), dry = new Color('#a7b84c'), hill = new Color('#5d9a48'), mud = new Color('#5b5a3a'), bank = new Color('#8f9a52'), c = new Color()
    for (let i = 0; i < p.count; i += 3) {
      // colour per face, from its centroid
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
      const n = noise3(x * 0.05, 0, z * 0.05)
      c.copy(meadow).lerp(dry, Math.max(0, n) * 0.8)
      c.lerp(hill, smooth(y, 2, 18))
      const pr = Math.hypot(x - POND.x, z - POND.z)
      c.lerp(bank, 1 - smooth(pr, POND_R + 0.5, POND_R + 4))
      c.lerp(mud, 1 - smooth(pr, POND_R - 2, POND_R + 0.5))
      const fr = Math.hypot(x - FIRE.x, z - FIRE.z)
      c.lerp(new Color('#6b5a3c'), (1 - smooth(fr, 1.6, 3.4)) * 0.8)
      const k = 1 + (noise3(x * 0.7, 3, z * 0.7)) * 0.06
      for (let j = 0; j < 3; j++) col.set([c.r * k, c.g * k, c.b * k], (i + j) * 3)
    }
    g.setAttribute('color', new BufferAttribute(col, 3))
    const ground = new Mesh(g, toon('#ffffff', { vertexColors: true, rim: 0 }))
    ground.receiveShadow = true
    ground.name = 'ground'
    this.group.add(ground)
  }

  private buildGrass(r: Rand, count: number) {
    // one blade: tapered strip, 4 segments
    const ys = [0, 0.3, 0.58, 0.82, 1]
    const ws = [0.07, 0.062, 0.048, 0.03, 0]
    const verts: number[] = []
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i]!, y1 = ys[i + 1]!, w0 = ws[i]!, w1 = ws[i + 1]!
      verts.push(-w0, y0, 0, w0, y0, 0, -w1, y1, 0)
      if (w1 > 0) verts.push(w0, y0, 0, w1, y1, 0, -w1, y1, 0)
    }
    const blade = new BufferGeometry()
    blade.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))

    const mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog]),
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      side: DoubleSide,
      fog: true,
    })
    Object.assign(mat.uniforms, {
      uTime: G.uTime, uGust: G.uGust, uPointerGround: G.uPointerGround, uPointerStrength: G.uPointerStrength,
      uSunDir: G.uSunDir, uSunColor: G.uSunColor, uSkyAmb: G.uSkyAmb,
      uFirePos: G.uFirePos, uFireColor: G.uFireColor, uFireIntensity: G.uFireIntensity,
    })

    const mesh = new InstancedMesh(blade, mat, count)
    const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), up = new Vector3(0, 1, 0)
    const greens = ['#5f9b37', '#6fae3f', '#80bb48', '#94c24f', '#a9c856', '#5a8f3a'].map((h) => new Color(h))
    const c = new Color()
    const gauss = () => (r() + r() + r() - 1.5) / 1.5
    // natural clumps scattered over the open meadow fill the sparse stretches
    const clumps = Array.from({ length: 320 }, () => [range(r, -95, 95), range(r, -365, -150)] as const)
    let placed = 0
    while (placed < count) {
      const k = r()
      if (k < 0.24) p.set(SIGN.x - 2 + gauss() * 20, 0, SIGN.z + 4 + gauss() * 18)
      else if (k < 0.44) {
        const a = r() * Math.PI * 2, d = POND_R + 0.2 + Math.pow(r(), 1.6) * 22
        p.set(POND.x + Math.cos(a) * d, 0, POND.z + Math.sin(a) * d)
      } else if (k < 0.54) p.set(FIRE.x + gauss() * 12, 0, FIRE.z + gauss() * 10)
      else if (k < 0.72) {
        const [cx, cz] = clumps[Math.floor(r() * clumps.length)]!
        p.set(cx + gauss() * 2.2, 0, cz + gauss() * 2.2)
      } else p.set(range(r, -100, 100), 0, range(r, -370, -150))
      const pr = Math.hypot(p.x - POND.x, p.z - POND.z)
      if (pr < POND_R + 0.2) continue
      if (Math.hypot(p.x - FIRE.x, p.z - FIRE.z) < 2.6) continue
      if (Math.hypot(p.x - SIGN.x, p.z - SIGN.z) < 0.5) continue
      // keep the foreground in front of the campfire camera open
      if (Math.hypot(p.x - 7.6, p.z + 258.5) < 3.2) continue
      p.y = groundHeight(p.x, p.z) - 0.02
      q.setFromAxisAngle(up, r() * Math.PI)
      // short grass at the foot of the sign so the squirrels show
      const nearSign = Math.hypot(p.x - SIGN.x, p.z - SIGN.z) < 3.2 ? 0.4 : 1
      // blades further from the paths are a little fuller, so the open ground reads as grass
      const far = Math.min(1, Math.hypot(p.x - SIGN.x, p.z - (SIGN.z - 40)) / 70)
      const h = range(r, 0.45, 1.05) * (pr < POND_R + 3 ? 1.3 : 1) * nearSign * (1 + far * 0.35)
      s.set(range(r, 0.8, 1.3) * (1 + far * 0.9), h, 1)
      mesh.setMatrixAt(placed, m.compose(p, q, s))
      c.copy(greens[Math.floor(r() * greens.length)]!)
      mesh.setColorAt(placed, c)
      placed++
    }
    mesh.frustumCulled = false
    this.grass = mesh
    this.grassAlloc = count
    this.group.add(mesh)
  }

  private buildTrees(r: Rand) {
    const spots: { p: Vector3; s: number }[] = []
    let tries = 0
    while (spots.length < 90 && tries++ < 4000) {
      const a = r() * Math.PI * 2, d = 38 + Math.pow(r(), 1.4) * 200
      const x = CENTER.x + Math.cos(a) * d * 1.2, z = CENTER.z + Math.sin(a) * d
      // keep the meadow, pond, campfire and the bird's flight line clear
      if (x > -36 && x < 42 && z > -326 && z < -172) continue
      spots.push({ p: new Vector3(x, groundHeight(x, z), z), s: range(r, 0.8, 1.7) })
    }
    const canopyGeo = flat(blob(2.6, 1, 0.25, 3, [1, 1.25, 1]))
    canopyGeo.translate(0, 4.2, 0)
    const trunkGeo = flat(new CylinderGeometry(0.28, 0.42, 3.4, 6))
    trunkGeo.translate(0, 1.6, 0)
    const canopy = new InstancedMesh(canopyGeo, toon('#ffffff', { rim: 0.8 }), spots.length)
    const trunk = new InstancedMesh(trunkGeo, toon('#6b4a32', { rim: 0.3 }), spots.length)
    const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), up = new Vector3(0, 1, 0)
    const tones = ['#4f8f3a', '#5f9c3f', '#3f7d3a', '#6aa244', '#4b8a4a'].map((h) => new Color(h))
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, r() * 6.28)
      s.setScalar(t.s)
      m.compose(t.p, q, s)
      canopy.setMatrixAt(i, m)
      trunk.setMatrixAt(i, m)
      canopy.setColorAt(i, tones[i % tones.length]!)
    })
    for (const mesh of [canopy, trunk]) {
      mesh.castShadow = true
      mesh.computeBoundingSphere()
      this.group.add(mesh)
    }
  }

  private buildRocksAndBushes(r: Rand) {
    const rockGeo = flat(new DodecahedronGeometry(0.7, 0))
    const rocks: Matrix4[] = []
    const q = new Quaternion(), s = new Vector3(), p = new Vector3(), e = new Euler()
    const addRock = (x: number, z: number, size: number) => {
      p.set(x, groundHeight(x, z) + size * 0.15, z)
      q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3))
      s.set(size * range(r, 0.9, 1.4), size * range(r, 0.55, 0.85), size)
      rocks.push(new Matrix4().compose(p, q, s))
    }
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = POND_R + range(r, 0.2, 2.2)
      addRock(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d, range(r, 0.5, 1.4))
    }
    for (let i = 0; i < 14; i++) addRock(SIGN.x + range(r, -18, 18), SIGN.z + range(r, -16, 8), range(r, 0.35, 0.9))
    const rockMesh = new InstancedMesh(rockGeo, toon('#9a958a', { rim: 0.6 }), rocks.length)
    rocks.forEach((m, i) => rockMesh.setMatrixAt(i, m))
    rockMesh.castShadow = rockMesh.receiveShadow = true
    rockMesh.computeBoundingSphere()
    this.group.add(rockMesh)

    const bushGeo = flat(blob(1, 1, 0.3, 21, [1.2, 0.8, 1.1]))
    const bushes: Matrix4[] = []
    const bushSpots: [number, number, number][] = [
      [SIGN.x + 7, SIGN.z - 8, 1.6], [SIGN.x + 10, SIGN.z - 3, 1.2], [SIGN.x - 10, SIGN.z - 12, 1.8],
      [SIGN.x + 3, SIGN.z - 13, 1.3], [-14, -204, 1.4], [16, -196, 1.6],
      [POND.x + 25, POND.z - 6, 1.5], [POND.x - 26, POND.z + 4, 1.7], [POND.x + 18, POND.z - 19, 1.4],
      [POND.x - 15, POND.z - 21, 1.6], [FIRE.x + 6, FIRE.z - 5, 1.4], [FIRE.x + 4, FIRE.z + 6, 1.1],
    ]
    for (const [x, z, k] of bushSpots) {
      p.set(x, groundHeight(x, z) + k * 0.35, z)
      q.identity()
      s.setScalar(k)
      bushes.push(new Matrix4().compose(p, q, s))
    }
    const bushMesh = new InstancedMesh(bushGeo, toon('#5a9a3e', { rim: 0.9 }), bushes.length)
    bushes.forEach((m, i) => bushMesh.setMatrixAt(i, m))
    bushMesh.castShadow = true
    bushMesh.computeBoundingSphere()
    this.group.add(bushMesh)
  }

  private buildFarClouds(r: Rand) {
    const mat = cloudMaterial({ push: 0, fadeNear: 0, fadeFar: 0, fog: false })
    for (let i = 0; i < 9; i++) {
      const mesh = new Mesh(cloudGeometry(300 + i, 1), mat)
      const a = range(r, -2.6, 0.5), d = range(r, 380, 620)
      mesh.position.set(Math.sin(a) * d, range(r, 140, 230), CENTER.z - Math.cos(a) * d)
      mesh.scale.setScalar(range(r, 3, 5.5))
      mesh.rotation.y = r() * 6
      this.farClouds.add(mesh)
    }
    this.group.add(this.farClouds)
  }

  setQuality(q: Quality) {
    this.grass.count = Math.min(this.grassAlloc, q.grass)
  }

  update() {
    this.farClouds.visible = state.wp < 0.79
  }
}
