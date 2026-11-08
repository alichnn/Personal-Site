import {
  BackSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import type { Quality } from '../core/quality'
import { CLOUD_SEA_Y } from '../core/layout'
import { rng, range } from '../core/util'
import { smooth } from '../core/timeline'
import { state } from '../core/state'
import { cloudGeometry, cloudMaterial } from './cloudkit'

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // pin to the far plane
}`

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uHorizon * 0.9, 1.0 - smoothstep(-0.3, 0.0, h));
  float s = dot(d, normalize(uSunDir));
  // halo, then a hard toon disc
  col += uSunColor * pow(max(s, 0.0), 6.0) * 0.28;
  col += uSunColor * pow(max(s, 0.0), 60.0) * 0.4;
  col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.7, s) * 1.8;
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // dither away banding
  gl_FragColor = vec4(col, 1.0);
}`

/** Sky dome (follows the camera) plus the sea of clouds below the sky scenes. */
export class Sky implements WorldModule {
  range: [number, number] = [0, 1]
  group = new Group()
  built = false
  dome!: Mesh
  private uniforms = {
    uZenith: { value: new Vector3() },
    uHorizon: { value: new Vector3() },
    uSunDir: { value: new Vector3() },
    uSunColor: { value: new Vector3() },
    uSunSize: { value: 0.001 },
  }
  private sea = new Group()
  private seaMeshes: InstancedMesh[] = []
  private seaCounts: number[] = []

  build() {
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      fog: false,
    })
    this.dome = new Mesh(new SphereGeometry(1000, 48, 24), mat)
    this.dome.renderOrder = -10
    this.dome.frustumCulled = false
    this.group.add(this.dome)

    // Sea of clouds: big flattened puffs on a jittered grid.
    const r = rng(77)
    const templates = [cloudGeometry(901, 1), cloudGeometry(902, 1), cloudGeometry(903, 1)]
    const mat2 = cloudMaterial({ push: 0, fadeNear: 4, fadeFar: 18 })
    const spots: Matrix4[][] = templates.map(() => [])
    const q = new Quaternion(), s = new Vector3(), p = new Vector3(), up = new Vector3(0, 1, 0)
    for (let gx = -11; gx <= 11; gx++) {
      for (let gz = -9; gz <= 12; gz++) {
        p.set(gx * 62 + range(r, -22, 22), CLOUD_SEA_Y + range(r, -6, 5), gz * 62 + range(r, -22, 22) - 60)
        q.setFromAxisAngle(up, r() * Math.PI * 2)
        const k = range(r, 2.2, 3.6)
        s.set(k, k * range(r, 0.45, 0.7), k)
        spots[Math.floor(r() * templates.length)]!.push(new Matrix4().compose(p, q, s))
      }
    }
    templates.forEach((geo, i) => {
      const list = spots[i]!
      const mesh = new InstancedMesh(geo, mat2, list.length)
      list.forEach((m, j) => mesh.setMatrixAt(j, m))
      mesh.frustumCulled = false
      this.seaMeshes.push(mesh)
      this.seaCounts.push(list.length)
      this.sea.add(mesh)
    })
    this.group.add(this.sea)
  }

  setQuality(q: Quality) {
    this.seaMeshes.forEach((m, i) => (m.count = Math.round(this.seaCounts[i]! * (0.45 + 0.55 * q.clouds))))
  }

  update(w: World) {
    const a = w.atmo
    const u = this.uniforms
    u.uZenith.value.set(a.zenith.r, a.zenith.g, a.zenith.b)
    u.uHorizon.value.set(a.horizon.r, a.horizon.g, a.horizon.b)
    u.uSunDir.value.copy(a.sunDir)
    u.uSunColor.value.set(a.sunColor.r, a.sunColor.g, a.sunColor.b)
    u.uSunSize.value = a.sunSize

    const camY = w.camera.position.y
    this.sea.visible = state.wp < 0.47 && camY > CLOUD_SEA_Y - 3
    // white-out while passing through the sea of clouds, and inside the cloud walls
    const seaFog = 1 - smooth(Math.abs(camY - CLOUD_SEA_Y - 2), 4, 14)
    a.cloudFog = Math.max(state.wp < 0.47 ? seaFog * 0.9 : 0, w.clouds.group.visible ? w.clouds.wallFog : 0)
  }

  afterCamera(w: World) {
    this.dome.position.copy(w.camera.position)
  }
}
