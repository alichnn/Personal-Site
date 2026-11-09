import { Group, Vector3 } from 'three'
import type { World, WorldModule } from '../core/world'
import { G, state } from '../core/state'
import { SIGN, groundHeight } from '../core/layout'
import { rng, range } from '../core/util'
import { signArrows } from '../data/content'
import { makeSignpost, makeSquirrel, makeSunflower } from './models'

interface Flower { root: Group; head: Group; phase: number; baseYaw: number }
interface Squirrel { parts: ReturnType<typeof makeSquirrel>; phase: number; nextLook: number; lookUntil: number; flickAt: number; lastFlick: number }

export class Meadow implements WorldModule {
  range: [number, number] = [0.4, 0.7]
  group = new Group()
  built = false
  private flowers: Flower[] = []
  private squirrels: Squirrel[] = []
  private sign = new Group()

  async build(w: World) {
    const sign = await makeSignpost(signArrows)
    sign.root.position.set(SIGN.x, groundHeight(SIGN.x, SIGN.z) - 0.05, SIGN.z)
    // face the meadow camera
    const camPos = new Vector3(), look = new Vector3()
    w.rig.sample(0.55, camPos, look)
    sign.root.rotation.y = Math.atan2(camPos.x - SIGN.x, camPos.z - SIGN.z) - 0.12
    this.group.add(sign.root)
    this.sign = sign.root
    this.resize(w)

    // sunflowers: behind and to the right of the sign, a few to the left
    const r = rng(12)
    const spots: [number, number][] = [
      [5.2, -3.5], [6.6, -2.0], [7.8, -4.2], [6.0, -5.6], [9.0, -1.2], [8.4, -6.8], [4.2, -6.4],
      [-3.4, -4.6], [-4.6, -6.2], [-2.6, -7.4], [10.4, -4.4],
    ]
    spots.forEach(([dx, dz], i) => {
      const f = makeSunflower(100 + i)
      const x = SIGN.x + dx, z = SIGN.z + dz
      f.root.position.set(x, groundHeight(x, z) - 0.05, z)
      const yaw = Math.atan2(camPos.x - x, camPos.z - z) + range(r, -0.5, 0.5)
      f.root.rotation.y = yaw
      this.group.add(f.root)
      this.flowers.push({ root: f.root, head: f.head, phase: r() * 6.28, baseYaw: 0 })
    })

    // squirrels at the foot of the sign
    const squirrelSpots: [number, number, number][] = [[-1.5, 1.1, 0.5], [1.9, 0.9, -0.7]]
    for (const [dx, dz, yawOff] of squirrelSpots) {
      const s = makeSquirrel()
      const x = SIGN.x + dx, z = SIGN.z + dz
      s.root.position.set(x, groundHeight(x, z), z)
      s.root.scale.setScalar(0.56)
      const yaw = Math.atan2(camPos.x - x, camPos.z - z) + yawOff
      s.root.rotation.y = yaw
      this.group.add(s.root)
      this.squirrels.push({ parts: s, phase: r() * 10, nextLook: 2 + r() * 4, lookUntil: 0, flickAt: 1 + r() * 3, lastFlick: -10 })
    }
  }

  /** A little smaller on tall phone screens, so both arrow tips stay in view. */
  resize(w: World) {
    this.sign.scale.setScalar(1 - 0.14 * w.rig.narrow)
  }

  update() {
    const t = state.time
    const motion = state.reduced ? 0 : 1
    const gust = 1 + G.uGust.value * 1.5

    for (const f of this.flowers) {
      // heavier, slower rhythm than the grass
      f.root.rotation.z = Math.sin(t * 0.55 + f.phase) * 0.045 * gust * motion
      f.root.rotation.x = Math.sin(t * 0.43 + f.phase * 1.3) * 0.03 * gust * motion
      f.head.rotation.y = Math.sin(t * 0.21 + f.phase) * 0.28 * motion
      f.head.rotation.x = 0.3 + Math.sin(t * 0.7 + f.phase) * 0.05 * motion
    }

    for (const s of this.squirrels) {
      const { head, hands, tail, body } = s.parts
      if (t > s.nextLook && t > s.lookUntil) {
        s.lookUntil = t + 2.4
        s.nextLook = s.lookUntil + 3.5 + Math.random() * 4.5
      }
      const looking = t < s.lookUntil ? Math.sin(Math.min(1, (s.lookUntil - t) / 2.4) * Math.PI) : 0
      const lk = Math.min(1, looking * 2.5)
      // nibble: quick little head bobs with the nut held up
      const nib = Math.sin(t * 17 + s.phase) * (1 - lk) * motion
      head.rotation.x = (0.12 + nib * 0.07) * (1 - lk) - lk * 0.18
      head.rotation.y = lk * Math.sin((s.lookUntil - t) * 2.6) * 0.75 * motion
      hands.position.y = 0.74 + nib * 0.012 - lk * 0.14
      hands.rotation.x = lk * 0.4
      // tail flick now and then
      if (t > s.flickAt) {
        s.lastFlick = t
        s.flickAt = t + 2.5 + Math.random() * 4
      }
      const since = t - s.lastFlick
      tail.rotation.x = Math.sin(t * 1.3 + s.phase) * 0.05 * motion + Math.exp(-since * 5) * Math.sin(since * 30) * 0.25 * motion
      body.position.y = Math.abs(Math.sin(t * 17 + s.phase)) * 0.006 * motion
    }
  }
}
