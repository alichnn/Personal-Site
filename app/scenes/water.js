import * as THREE from 'three'
import { toonMaterial, toonMesh } from '../utils/toon'
import { bell } from '../utils/easing'
import { makeGlowTexture } from '../utils/glowTexture'

export function buildWater(scene) {
  const group = new THREE.Group()
  group.position.set(0, -2.6, -100)
  scene.add(group)

  // ---- river leading up to the falls ----
  const riverGeo = new THREE.PlaneGeometry(26, 40, 20, 30)
  const riverBase = riverGeo.attributes.position.array.slice()
  const river = new THREE.Mesh(riverGeo, toonMaterial('#2f7fb0'))
  river.rotation.x = -Math.PI / 2
  river.position.z = 10
  group.add(river)

  // banks
  const bankGeo = new THREE.PlaneGeometry(40, 40)
  const bankL = new THREE.Mesh(bankGeo, toonMaterial('#6fae52'))
  bankL.rotation.x = -Math.PI / 2
  bankL.position.set(-30, -0.05, 10)
  group.add(bankL)
  const bankR = bankL.clone()
  bankR.position.x = 30
  group.add(bankR)

  // ---- cliff face the falls drop over: a thin double-sided backdrop,
  // not a solid volume, so the camera can never end up "inside" it ----
  const cliffMat = toonMaterial('#8a7a63', { side: THREE.DoubleSide })
  const cliff = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), cliffMat)
  cliff.position.set(0, 2, -28)
  group.add(cliff)

  // ---- falling cascade: a curtain of streaks looping downward ----
  const CASCADE_COUNT = 240
  const cascadePos = new Float32Array(CASCADE_COUNT * 3)
  const cascadeSeed = new Float32Array(CASCADE_COUNT)
  for (let i = 0; i < CASCADE_COUNT; i++) {
    cascadePos[i * 3 + 0] = (Math.random() - 0.5) * 9
    cascadePos[i * 3 + 1] = Math.random() * 9
    cascadePos[i * 3 + 2] = -27.5 + (Math.random() - 0.5) * 1.2
    cascadeSeed[i] = Math.random()
  }
  const cascadeGeo = new THREE.BufferGeometry()
  cascadeGeo.setAttribute('position', new THREE.BufferAttribute(cascadePos, 3))
  const cascadeMat = new THREE.PointsMaterial({
    map: makeGlowTexture(),
    color: '#eaf6ff', size: 0.5, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const cascade = new THREE.Points(cascadeGeo, cascadeMat)
  group.add(cascade)

  return { group, river, riverGeo, riverBase, cliff, cascade, cascadeSeed }
}

export function updateWater(water, { progress, elapsed, T }) {
  const v = bell(progress, ...T.waterScene)
  water.group.visible = v > 0.001
  if (v <= 0.001) return

  // river ripple
  const arr = water.riverGeo.attributes.position.array
  const base = water.riverBase
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i], y = base[i + 1]
    arr[i + 2] = base[i + 2] + Math.sin(x * 0.4 + elapsed * 1.4) * 0.3 + Math.cos(y * 0.3 + elapsed * 1.1) * 0.3
  }
  water.riverGeo.attributes.position.needsUpdate = true
  water.cascade.material.opacity = v * 0.9

  // cascade: each streak falls and loops back to the top
  const pos = water.cascade.geometry.attributes.position.array
  const seeds = water.cascadeSeed
  for (let i = 0; i < seeds.length; i++) {
    const idx = i * 3 + 1
    pos[idx] = 9 - ((elapsed * (4 + seeds[i] * 3) + seeds[i] * 9) % 9)
  }
  water.cascade.geometry.attributes.position.needsUpdate = true
}
