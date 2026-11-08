import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import { SKY_Y } from '../core/layout'
import { state } from '../core/state'
import { addOutline, toon } from '../core/toon'
import { hero as heroCopy } from '../data/content'
import { cloudGeometry, cloudMaterial } from './cloudkit'

/** Alice's photo in a toon frame, hanging from a small passing cloud. */
export class Hero implements WorldModule {
  range: [number, number] = [0.07, 0.3]
  group = new Group()
  built = false
  private rigGroup = new Group()
  private anchor = new Vector3()
  private scale = 1

  async build() {
    const tex = await new TextureLoader().loadAsync(heroCopy.photo.src)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4

    const W = 2, H = 3, B = 0.16
    const wood = toon('#f1dfc0', { rim: 0.8 })
    const frame = new Group()
    const bars: [number, number, number, number][] = [
      [0, H / 2 + B / 2, W + B * 2, B],
      [0, -H / 2 - B / 2, W + B * 2, B],
      [-W / 2 - B / 2, 0, B, H],
      [W / 2 + B / 2, 0, B, H],
    ]
    for (const [x, y, w, h] of bars) {
      const m = new Mesh(new BoxGeometry(w, h, 0.16), wood)
      m.position.set(x, y, 0)
      addOutline(m, 0.025, '#3a2a1e')
      frame.add(m)
    }
    const back = new Mesh(new BoxGeometry(W + B, H + B, 0.06), toon('#d9c3a0'))
    back.position.z = -0.06
    frame.add(back)
    const photo = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }))
    photo.position.z = 0.0
    frame.add(photo)

    // strings up to the cloud
    const string = toon('#e8e2d6', { rim: 0 })
    for (const sx of [-0.7, 0.7]) {
      const s = new Mesh(new CylinderGeometry(0.012, 0.012, 2.4, 4), string)
      s.position.set(sx, H / 2 + B + 1.2, 0)
      frame.add(s)
    }
    const cloud = new Mesh(cloudGeometry(55, 2), cloudMaterial({ push: 0.2, fadeNear: 0.5, fadeFar: 2 }))
    cloud.scale.setScalar(0.17)
    cloud.position.set(0, H / 2 + B + 2.7, -0.2)
    frame.add(cloud)
    frame.position.y = -0.6

    this.rigGroup.add(frame)
    this.group.add(this.rigGroup)
  }

  /** Place the frame beside the text on wide screens and below it on tall ones. */
  resize(w: World) {
    const restPos = new Vector3(), restLook = new Vector3()
    const { fov } = w.rig.sample(0.16, restPos, restLook)
    const fwd = restLook.clone().sub(restPos).normalize()
    const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
    const d = 16
    const hh = d * Math.tan(MathUtils.degToRad(fov / 2))
    const aspect = innerWidth / innerHeight
    const hw = hh * aspect
    const wide = aspect >= 1
    this.anchor.copy(restPos).addScaledVector(fwd, d)
    if (wide) {
      this.anchor.addScaledVector(right, hw * 0.4)
      this.anchor.y = SKY_Y + hh * 0.02
      this.scale = (hh * 0.95) / 3.6
    } else {
      this.anchor.y = SKY_Y - hh * 0.3
      this.scale = Math.min((hh * 0.75) / 3.6, (hw * 0.92) / 2.4)
    }
    this.rigGroup.position.copy(this.anchor)
    this.rigGroup.lookAt(restPos)
  }

  update() {
    const t = state.time
    const motion = state.reduced ? 0 : 1
    this.rigGroup.position.copy(this.anchor)
    this.rigGroup.position.y += Math.sin(t * 0.8) * 0.16 * motion * this.scale
    this.rigGroup.scale.setScalar(this.scale)
    this.rigGroup.children[0]!.rotation.z = Math.sin(t * 0.55) * 0.03 * motion
  }
}
