import { CatmullRomCurve3, CylinderGeometry, Group, Mesh, Vector3 } from 'three'
import type { World, WorldModule } from '../core/world'
import { state } from '../core/state'
import { ISLET, ISLET_TOP, TWIG, groundHeight } from '../core/layout'
import { T, bell, damp, smooth } from '../core/timeline'
import { flat, paint } from '../core/util'
import { makeBird } from './models'
import { addOutline, toon } from '../core/toon'

const PERCH_H = 1.45

/** The bird: idles on its twig, then leads the camera from the meadow to the pond. */
export class Bird implements WorldModule {
  range: [number, number] = [0.4, 0.86]
  group = new Group()
  built = false
  private bird!: ReturnType<typeof makeBird>
  private flight!: CatmullRomCurve3
  private perch = new Vector3()
  private land = new Vector3()
  private yaw = 0
  private yawTarget = 0
  private baseYaw = 0
  private nextTurn = 5
  private nextHop = 2
  private hopAt = -10
  private flickAt = -10
  private nextFlick = 1.5
  private tmp = new Vector3()
  private tan = new Vector3()

  build(w: World) {
    const gy = groundHeight(TWIG.x, TWIG.z)
    this.perch.set(TWIG.x, gy + PERCH_H, TWIG.z)
    this.land.set(ISLET.x, ISLET_TOP + 0.02, ISLET.z)

    // a bare twig poking out of the grass
    const wood = toon('#6e4a2e', { rim: 0.4 })
    const stalk = new Mesh(flat(new CylinderGeometry(0.035, 0.07, PERCH_H + 0.1, 5)).translate(0, (PERCH_H + 0.1) / 2, 0), wood)
    stalk.position.set(TWIG.x, gy - 0.05, TWIG.z)
    stalk.rotation.z = 0.04
    const side = new Mesh(flat(new CylinderGeometry(0.018, 0.03, 0.6, 4)).translate(0, 0.3, 0), wood)
    side.position.set(TWIG.x, gy + 0.9, TWIG.z)
    side.rotation.set(0.2, 0, -0.8)
    const leaf = new Mesh(paint(flat(new CylinderGeometry(0.0, 0.09, 0.2, 4)).scale(1, 1, 0.3), '#7fbf4a'), toon('#ffffff', { vertexColors: true }))
    leaf.position.set(TWIG.x + 0.42, gy + 1.28, TWIG.z)
    leaf.rotation.z = -1.2
    for (const m of [stalk, side]) {
      addOutline(m, 0.012, '#24160f')
      m.castShadow = true
    }
    this.group.add(stalk, side, leaf)

    this.bird = makeBird()
    this.bird.root.scale.setScalar(0.33)
    this.group.add(this.bird.root)

    // face the meadow camera to start with
    const cam = new Vector3(), look = new Vector3()
    w.rig.sample(0.56, cam, look)
    this.baseYaw = this.yaw = this.yawTarget = Math.atan2(cam.x - TWIG.x, cam.z - TWIG.z) + 0.9

    const p = this.perch
    this.flight = new CatmullRomCurve3([
      p.clone(),
      p.clone().add(new Vector3(-0.6, 1.8, -3)),
      new Vector3(-5, 8, -226),
      new Vector3(-11, 11, -243),
      new Vector3(-13.5, 6.5, -260),
      new Vector3(-11, 2.4, -274),
      this.land.clone().add(new Vector3(0, 0.5, 2.2)),
      this.land.clone(),
    ], false, 'centripetal')
  }

  update(w: World) {
    const t = state.time
    const dt = state.dt
    const motion = state.reduced ? 0 : 1
    const b = this.bird
    const s = smooth(state.wp, T.bird[0] + 0.002, T.bird[1] - 0.002)
    const flying = s > 0.001 && s < 0.999

    if (flying) {
      const u = s
      this.flight.getPointAt(u, b.root.position)
      this.flight.getTangentAt(Math.min(0.999, u), this.tan)
      b.root.lookAt(this.tmp.copy(b.root.position).add(this.tan))
      // the bird model faces +z, lookAt points +z at the target
      const glide = 0.55 + 0.45 * Math.sin(u * Math.PI * 4)
      const flap = Math.sin(t * 24) * 0.95 * glide * motion
      const flare = smooth(u, 0.88, 1)
      for (const [i, wing] of b.wings.entries()) {
        const sgn = i === 0 ? -1 : 1
        wing.rotation.set(0, 0, sgn * (flap * (1 - flare) - 0.2 + flare * 0.9))
      }
      b.tail.rotation.x = -0.1 + flare * -0.4
      b.body.position.y = 0
      b.head.rotation.set(0, 0, 0)
      // camera follows the bird for the middle of the flight
      const wgt = bell(state.wp, 0.621, 0.631, 0.651, 0.663)
      if (wgt > 0) {
        const o = w.rig.override
        o.weight = wgt
        const back = Math.max(0, u - 0.085)
        this.flight.getPointAt(back, o.pos)
        o.pos.y += 1.1
        o.pos.x += 1.4
        o.look.copy(b.root.position)
      }
      return
    }

    // perched (on the twig before the flight, on the islet after)
    const at = s >= 0.999 ? this.land : this.perch
    b.root.position.copy(at)
    // turn around now and then
    if (t > this.nextTurn) {
      this.nextTurn = t + 6 + Math.random() * 3
      this.yawTarget = this.yawTarget === this.baseYaw ? this.baseYaw + Math.PI * 0.9 : this.baseYaw
      this.hopAt = t
    }
    if (t > this.nextHop) {
      this.nextHop = t + 2.5 + Math.random() * 2.5
      this.hopAt = t
    }
    if (t > this.nextFlick) {
      this.nextFlick = t + 1.2 + Math.random() * 2.2
      this.flickAt = t
    }
    this.yaw = damp(this.yaw, this.yawTarget, 9, dt)
    b.root.rotation.set(0, motion ? this.yaw : this.baseYaw, 0)
    const hop = Math.max(0, Math.sin(Math.min(1, (t - this.hopAt) / 0.28) * Math.PI))
    b.body.position.y = hop * 0.35 * motion
    const fl = t - this.flickAt
    b.tail.rotation.x = -0.35 + (fl < 0.4 ? Math.sin((fl / 0.4) * Math.PI) * 0.55 : 0) * motion
    b.head.rotation.y = Math.sin(t * 0.9) * 0.35 * motion
    b.head.rotation.z = Math.sin(t * 0.63 + 1) * 0.15 * motion
    // wings folded back along the body, fluttering open on a hop
    for (const [i, wing] of b.wings.entries()) {
      const sgn = i === 0 ? 1 : -1
      wing.rotation.set(0, -sgn * 1.3 * (1 - hop * 0.5), -sgn * hop * 0.7)
    }
  }
}
