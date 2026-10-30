import * as THREE from 'three'
import { makeGlowTexture } from '../utils/glowTexture'

// One particle system that plays two roles: rising white waterfall mist,
// then (as the same particles) drifting warm fireflies around the
// fireplace. The water->fire transition is this system gradually
// recoloring and changing motion, not a hard cut to a new object.
export function buildMistFireflies(scene) {
  const COUNT = 260
  const basePos = new Float32Array(COUNT * 3)
  const pos = new Float32Array(COUNT * 3)
  const color = new Float32Array(COUNT * 3)
  const seed = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    basePos[i * 3 + 0] = (Math.random() - 0.5) * 10
    basePos[i * 3 + 1] = Math.random() * 3
    basePos[i * 3 + 2] = (Math.random() - 0.5) * 6
    seed[i] = Math.random() * Math.PI * 2
  }
  pos.set(basePos)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3))
  const mat = new THREE.PointsMaterial({
    map: makeGlowTexture(),
    size: 0.4, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)

  return { points, geo, mat, basePos, seed, count: COUNT }
}

// anchorMist / anchorFire: world positions the particles orbit around in
// each mode. mixT (0..1) blends position + color + motion between them.
export function updateMistFireflies(sys, { elapsed, anchorMist, anchorFire, mixT, visible, opacity }) {
  sys.points.visible = visible
  if (!visible) return
  sys.mat.opacity = opacity

  const pos = sys.geo.attributes.position.array
  const color = sys.geo.attributes.color.array
  const { basePos, seed, count } = sys

  const mistCol = new THREE.Color('#eaf6ff')
  const fireCol = new THREE.Color('#ffcf6b')

  for (let i = 0; i < count; i++) {
    const idx = i * 3
    const s = seed[i]

    // mist mode: gentle upward drift near the waterfall base
    const mistY = ((elapsed * 0.6 + s * 4) % 6) - 1
    const mistX = basePos[idx + 0] + Math.sin(elapsed * 0.5 + s) * 0.8
    const mistZ = basePos[idx + 2] + Math.cos(elapsed * 0.4 + s) * 0.8

    // firefly mode: erratic hovering drift near the fireplace
    const fireX = Math.sin(elapsed * 0.7 + s * 3) * 3.2
    const fireY = 1 + Math.sin(elapsed * 1.3 + s * 5) * 0.8 + Math.sin(elapsed * 0.3 + s) * 0.6
    const fireZ = Math.cos(elapsed * 0.6 + s * 2) * 3.2

    pos[idx + 0] = (anchorMist.x + mistX) * (1 - mixT) + (anchorFire.x + fireX) * mixT
    pos[idx + 1] = (anchorMist.y + mistY) * (1 - mixT) + (anchorFire.y + fireY) * mixT
    pos[idx + 2] = (anchorMist.z + mistZ) * (1 - mixT) + (anchorFire.z + fireZ) * mixT

    const flicker = mixT > 0.5 ? (0.4 + 0.6 * Math.max(0, Math.sin(elapsed * 3 + s * 6))) : 1
    const c = mistCol.clone().lerp(fireCol, mixT)
    color[idx + 0] = c.r * flicker
    color[idx + 1] = c.g * flicker
    color[idx + 2] = c.b * flicker
  }
  sys.geo.attributes.position.needsUpdate = true
  sys.geo.attributes.color.needsUpdate = true
}
