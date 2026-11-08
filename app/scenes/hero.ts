import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Path,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import type { World, WorldModule } from '../core/world'
import { SKY_Y } from '../core/layout'
import { state } from '../core/state'
import { addOutline, toon } from '../core/toon'
import { blob, flat, merge, paint, rng } from '../core/util'
import { hero as heroCopy } from '../data/content'
import { cloudGeometry, cloudMaterial } from './cloudkit'
import { paintGrain } from './models'

/** Alice's photo in a chunky toon-wood frame with a flowering vine, hanging from a small passing cloud. */
export class Hero implements WorldModule {
  range: [number, number] = [0.07, 0.3]
  group = new Group()
  built = false
  private rigGroup = new Group()
  private anchor = new Vector3()
  private scale = 1
  /** Outer frame size before scaling. */
  private size = new Vector2(2.7, 3.3)

  async build(w: World) {
    const img = new Image()
    img.src = heroCopy.photo.src
    await img.decode()
    const r = rng(21)

    // The photo sits on a cream mat, drawn into one mipmapped texture so it stays sharp at any
    // size and tilt. Its edges tuck under the frame's lip, so they never stair-step.
    const PW = 2, PH = (PW * img.naturalHeight) / img.naturalWidth, MAT = 0.13
    const pxPerUnit = img.naturalWidth / PW
    const canvas = document.createElement('canvas')
    canvas.width = Math.round((PW + MAT * 2) * pxPerUnit)
    canvas.height = Math.round((PH + MAT * 2) * pxPerUnit)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f4ead6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const m = Math.round(MAT * pxPerUnit)
    ctx.drawImage(img, m, m, img.naturalWidth, img.naturalHeight)
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(58, 42, 30, 0.5)'
    ctx.strokeRect(m, m, img.naturalWidth, img.naturalHeight)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = w.renderer.capabilities.getMaxAnisotropy()

    const frame = new Group()
    const photo = new Mesh(new PlaneGeometry(PW + MAT * 2, PH + MAT * 2), new MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }))
    // just behind the frame's front face, so the opening's inner walls barely show
    photo.position.z = 0.07
    frame.add(photo)

    // chunky bevelled wooden frame: one extruded ring, toon-shaded with an ink outline
    const B = 0.24, LIP = 0.035
    const hw = PW / 2 + MAT - LIP, hh = PH / 2 + MAT - LIP
    const ow = hw + B, oh = hh + B
    const ring = new Shape([new Vector2(-ow, -oh), new Vector2(ow, -oh), new Vector2(ow, oh), new Vector2(-ow, oh)])
    ring.holes.push(new Path([new Vector2(-hw, -hh), new Vector2(-hw, hh), new Vector2(hw, hh), new Vector2(hw, -hh)]))
    const ringGeo = new ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.04, bevelSegments: 2, curveSegments: 1 })
    ringGeo.translate(0, 0, -0.02)
    planarUV(ringGeo)
    const wood = new Mesh(ringGeo, toon('#ffffff', { map: frameWood(ow, oh, hw, hh, w.renderer.capabilities.getMaxAnisotropy()), rim: 0.7 }))
    frame.add(wood)
    // ink outline around the outside only (a hull would also ring the opening, over the photo):
    // a slightly larger backing plate in ink colour
    const back = new Mesh(new BoxGeometry(ow * 2 + 0.11, oh * 2 + 0.11, 0.04), new MeshBasicMaterial({ color: '#3a2416' }))
    back.position.z = -0.08
    frame.add(back)
    const front = 0.1 + 0.045 - 0.02
    this.size.set(ow * 2 + 0.08, oh * 2 + 0.08)

    // a flowering vine curling over the top-left corner and down the side, and a small sprig
    // tucked into the bottom-right corner
    const bx = -(hw + B / 2), by = hh + B / 2
    const vine = new CatmullRomCurve3([
      new Vector3(0.55, by + 0.04, front),
      new Vector3(-0.2, by - 0.05, front + 0.02),
      new Vector3(bx * 0.72, by + 0.08, front + 0.03),
      new Vector3(bx + 0.02, by - 0.02, front + 0.04),
      new Vector3(bx - 0.07, by * 0.6, front + 0.02),
      new Vector3(bx + 0.06, by * 0.2, front + 0.03),
      new Vector3(bx - 0.04, -by * 0.2, front + 0.02),
      new Vector3(bx + 0.03, -by * 0.42, front + 0.02),
    ])
    const sprig = new CatmullRomCurve3([
      new Vector3(-bx + 0.04, -by * 0.45, front + 0.02),
      new Vector3(-bx - 0.05, -by * 0.75, front + 0.03),
      new Vector3(-bx * 0.82, -by - 0.03, front + 0.03),
      new Vector3(-bx * 0.45, -by + 0.04, front + 0.02),
    ])
    const parts: BufferGeometry[] = []
    const grow = (curve: CatmullRomCurve3, blooms: [number, string][], seed: number) => {
      parts.push(paint(flat(new TubeGeometry(curve, 72, 0.034, 6)), '#3f7a2a'))
      const len = curve.getLength()
      for (let t = 0.03, k = 0; t < 0.98; t += 0.22 / len, k++) {
        const p = curve.getPoint(t), tan = curve.getTangent(t)
        const side = k % 2 ? 1 : -1
        const leaf = flat(blob(0.1, 0, 0.2, seed + k, [1, 0.22, 0.58]))
        leaf.rotateY(Math.PI / 2).rotateZ(Math.atan2(tan.y, tan.x) + side * 0.85)
        leaf.translate(p.x - tan.y * side * 0.085, p.y + tan.x * side * 0.085, p.z + 0.015)
        parts.push(paint(leaf, k % 3 ? '#5aa23c' : '#7cbc4a', 0.08, r))
      }
      for (const [t, petal] of blooms) {
        const p = curve.getPoint(t)
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + t * 7
          const g = flat(new IcosahedronGeometry(0.068, 0)).scale(1, 0.64, 0.4).rotateZ(a)
          g.translate(p.x + Math.cos(a) * 0.075, p.y + Math.sin(a) * 0.075, p.z + 0.07)
          parts.push(paint(g, petal, 0.05, r))
        }
        parts.push(paint(flat(new IcosahedronGeometry(0.046, 0)).translate(p.x, p.y, p.z + 0.1), '#f6c234'))
      }
    }
    grow(vine, [[0.08, '#f49ac1'], [0.3, '#fff4e4'], [0.47, '#f7b6d0'], [0.68, '#fff4e4'], [0.9, '#f49ac1']], 60)
    grow(sprig, [[0.55, '#fff4e4'], [0.95, '#f7b6d0']], 90)
    const vineMesh = new Mesh(merge(parts), toon('#ffffff', { vertexColors: true, rim: 0.6 }))
    addOutline(vineMesh, 0.014, '#1f2a14')
    frame.add(vineMesh)

    // ropes up to the cloud, tied through little brass eyelets on the top of the frame
    const H = oh * 2
    const rope = toon('#d9c39a', { rim: 0.3 })
    const brass = toon('#c9a24a', { rim: 0.9 })
    for (const sx of [-0.75, 0.75]) {
      const ropeMesh = new Mesh(new CylinderGeometry(0.022, 0.022, 2.5, 6), rope)
      ropeMesh.position.set(sx, H / 2 + 1.25 + 0.06, 0)
      frame.add(ropeMesh)
      const eye = new Mesh(new TorusGeometry(0.06, 0.018, 6, 12), brass)
      eye.position.set(sx, H / 2 + 0.07, 0.03)
      frame.add(eye)
    }
    const cloud = new Mesh(cloudGeometry(55, 2), cloudMaterial({ push: 0.2, fadeNear: 0.5, fadeFar: 2 }))
    cloud.scale.setScalar(0.17)
    cloud.position.set(0, H / 2 + 2.75, -0.2)
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

/** UVs projected flat across the front, so a painted texture lines up with the shape. */
function planarUV(geo: BufferGeometry) {
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const pos = geo.getAttribute('position') as BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let k = 0; k < pos.count; k++) {
    uv[k * 2] = (pos.getX(k) - bb.min.x) / (bb.max.x - bb.min.x)
    uv[k * 2 + 1] = (pos.getY(k) - bb.min.y) / (bb.max.y - bb.min.y)
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
}

/**
 * The frame's wood: four mitred rails, each with grain running along its length, darker seams at
 * the corners, and worn edges (which the bevels pick up).
 */
function frameWood(ow: number, oh: number, hw: number, hh: number, anisotropy: number) {
  const r = rng(33)
  const W = 1024, H = Math.round((W * oh) / ow)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const sx = W / (ow * 2), sy = H / (oh * 2)
  const X = (x: number) => (x + ow) * sx, Y = (y: number) => (oh - y) * sy
  const o = [[-ow, oh], [ow, oh], [ow, -oh], [-ow, -oh]] as const
  const h = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]] as const
  const tones = ['#c08750', '#b47b47', '#ba814c', '#ae7542']
  // the opening's bevel and inner walls reach into the middle of the texture: shaded wood there
  ctx.fillStyle = '#93602f'
  ctx.fillRect(0, 0, W, H)
  for (let k = 0; k < 4; k++) {
    const a = o[k]!, b = o[(k + 1) % 4]!, ib = h[(k + 1) % 4]!, ia = h[k]!
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(X(a[0]), Y(a[1]))
    ctx.lineTo(X(b[0]), Y(b[1]))
    ctx.lineTo(X(ib[0]), Y(ib[1]))
    ctx.lineTo(X(ia[0]), Y(ia[1]))
    ctx.closePath()
    ctx.clip()
    ctx.fillStyle = tones[k]!
    ctx.fillRect(0, 0, W, H)
    // grain along the rail: rotate the canvas for the upright sides
    if (k % 2) {
      ctx.translate(W, 0)
      ctx.rotate(Math.PI / 2)
      paintGrain(ctx, H, W, r, 30)
    } else paintGrain(ctx, W, H, r, 40)
    ctx.restore()
  }
  // mitre seams and worn edges
  ctx.strokeStyle = 'rgba(70, 38, 16, 0.6)'
  ctx.lineWidth = 3
  for (let k = 0; k < 4; k++) {
    ctx.beginPath()
    ctx.moveTo(X(o[k]![0]), Y(o[k]![1]))
    ctx.lineTo(X(h[k]![0]), Y(h[k]![1]))
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(80, 44, 18, 0.5)'
  ctx.lineWidth = 22
  ctx.strokeRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(80, 44, 18, 0.3)'
  ctx.lineWidth = 8
  ctx.strokeRect(X(-hw), Y(hh), (hw * 2) * sx, (hh * 2) * sy)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}
