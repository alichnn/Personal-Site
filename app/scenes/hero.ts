import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import { SKY_Y } from '../core/layout'
import { state } from '../core/state'
import { toon } from '../core/toon'
import { hero as heroCopy } from '../data/content'
import { cloudGeometry, cloudMaterial } from './cloudkit'

/** Alice's photo as an ink-outlined print, hanging from a small passing cloud. */
export class Hero implements WorldModule {
  range: [number, number] = [0.07, 0.3]
  group = new Group()
  built = false
  private rigGroup = new Group()
  private anchor = new Vector3()
  private scale = 1
  /** Paper size before scaling. */
  private size = new Vector2(2.22, 3.03)

  async build(w: World) {
    const img = new Image()
    img.src = heroCopy.photo.src
    await img.decode()

    // The photo and its paper border are drawn into one texture, ink outline and soft shadow
    // included. Mipmapped texture filtering then gives clean, anti-aliased edges at any size and
    // tilt, where separate box geometry would stair-step (the scene runs without MSAA).
    const pw = img.naturalWidth, ph = img.naturalHeight
    const side = Math.round(pw * 0.055), bottom = Math.round(pw * 0.12)
    const ink = Math.max(4, Math.round(pw * 0.006))
    const pad = Math.round(pw * 0.06)
    const fw = pw + side * 2, fh = ph + side + bottom
    const canvas = document.createElement('canvas')
    canvas.width = fw + pad * 2
    canvas.height = fh + pad * 2
    const ctx = canvas.getContext('2d')!
    const r = pw * 0.012
    // soft shadow, then the paper with its ink outline
    ctx.save()
    ctx.shadowColor = 'rgba(16, 32, 92, 0.32)'
    ctx.shadowBlur = pw * 0.035
    ctx.shadowOffsetY = pw * 0.018
    ctx.beginPath()
    ctx.roundRect(pad, pad, fw, fh, r)
    ctx.fillStyle = '#f4ead6'
    ctx.fill()
    ctx.restore()
    ctx.lineWidth = ink
    ctx.strokeStyle = '#3a2a1e'
    ctx.beginPath()
    ctx.roundRect(pad + ink / 2, pad + ink / 2, fw - ink, fh - ink, r)
    ctx.stroke()
    // the photo, with a hairline edge where it meets the paper
    ctx.drawImage(img, pad + side, pad + side, pw, ph)
    ctx.lineWidth = Math.max(2, ink * 0.4)
    ctx.strokeStyle = 'rgba(58, 42, 30, 0.55)'
    ctx.strokeRect(pad + side, pad + side, pw, ph)

    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = w.renderer.capabilities.getMaxAnisotropy()
    tex.premultiplyAlpha = true

    // world size: the photo itself stays 2 units wide
    const k = 2 / pw
    const W = fw * k, H = fh * k
    this.size.set(W, H)
    const frame = new Group()
    const print = new Mesh(
      new PlaneGeometry(canvas.width * k, canvas.height * k),
      new MeshBasicMaterial({ map: tex, transparent: true, premultipliedAlpha: true, fog: false, toneMapped: false }),
    )
    frame.add(print)

    // strings up to the cloud
    const string = toon('#e8e2d6', { rim: 0 })
    for (const sx of [-0.7, 0.7]) {
      const s = new Mesh(new CylinderGeometry(0.012, 0.012, 2.4, 6), string)
      s.position.set(sx, H / 2 + 1.2, -0.01)
      frame.add(s)
    }
    const cloud = new Mesh(cloudGeometry(55, 2), cloudMaterial({ push: 0.2, fadeNear: 0.5, fadeFar: 2 }))
    cloud.scale.setScalar(0.17)
    cloud.position.set(0, H / 2 + 2.7, -0.2)
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
      this.scale = (hh * 0.95) / (this.size.y + 0.6)
    } else {
      this.anchor.y = SKY_Y - hh * 0.4
      this.scale = Math.min((hh * 0.62) / (this.size.y + 0.6), (hw * 0.86) / (this.size.x + 0.08))
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
