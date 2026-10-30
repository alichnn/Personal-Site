import * as THREE from 'three'
import { toonMaterial, toonMesh } from '../utils/toon'
import { bell } from '../utils/easing'

function rand(min, max) { return min + Math.random() * (max - min) }

export function buildEarth(scene) {
  const group = new THREE.Group()
  group.position.set(0, -3.6, -67)
  scene.add(group)

  // ---- ground ----
  const groundGeo = new THREE.PlaneGeometry(90, 50)
  const ground = new THREE.Mesh(groundGeo, toonMaterial('#7ec564'))
  ground.rotation.x = -Math.PI / 2
  group.add(ground)

  // ---- grass tufts: instanced blades that sway per-instance ----
  const bladeGeo = new THREE.ConeGeometry(0.1, 0.9, 4)
  bladeGeo.translate(0, 0.45, 0)
  const bladeMat = toonMaterial('#5fae4a')
  const BLADE_COUNT = 260
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADE_COUNT)
  const bladeBase = []
  const dummy = new THREE.Object3D()
  for (let i = 0; i < BLADE_COUNT; i++) {
    const x = rand(-40, 40)
    const z = rand(-20, 20)
    const s = rand(0.8, 1.6)
    const rotY = rand(0, Math.PI * 2)
    bladeBase.push({ x, z, s, rotY, phase: rand(0, Math.PI * 2), speed: rand(0.8, 1.4) })
    dummy.position.set(x, 0, z)
    dummy.rotation.set(0, rotY, 0)
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    blades.setMatrixAt(i, dummy.matrix)
  }
  group.add(blades)

  // ---- sunflowers: stem + head, a handful scattered + swaying as a group ----
  function makeSunflower() {
    const g = new THREE.Group()
    const stem = toonMesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), '#4c8a3c')
    stem.position.y = 1.1
    g.add(stem)
    const head = toonMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 10), '#f4c430')
    head.position.set(0, 2.3, 0.1)
    head.rotation.x = Math.PI / 2
    g.add(head)
    const center = toonMesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 10), '#6b4423')
    center.position.set(0, 2.3, 0.2)
    center.rotation.x = Math.PI / 2
    g.add(center)
    return g
  }
  const SUNFLOWER_COUNT = 16
  const sunflowers = []
  for (let i = 0; i < SUNFLOWER_COUNT; i++) {
    const f = makeSunflower()
    f.position.set(rand(-32, 32), 0, rand(-16, 16))
    f.rotation.y = rand(0, Math.PI * 2)
    const s = rand(0.85, 1.3)
    f.scale.setScalar(s)
    f.userData.phase = rand(0, Math.PI * 2)
    f.userData.speed = rand(0.5, 0.9)
    group.add(f)
    sunflowers.push(f)
  }

  // ---- bird on a twig: flips facing direction on an interval ----
  const birdGroup = new THREE.Group()
  const twig = toonMesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 5), '#6b4423')
  twig.rotation.z = Math.PI / 2 * 0.15
  birdGroup.add(twig)
  const birdBody = new THREE.Group()
  const body = toonMesh(new THREE.SphereGeometry(0.32, 10, 8), '#3d6fd1')
  body.userData.mesh.scale.set(1.2, 1, 1)
  body.userData.outline.scale.multiplyScalar(1.2)
  birdBody.add(body)
  const beak = toonMesh(new THREE.ConeGeometry(0.08, 0.22, 6), '#f0a830')
  beak.rotation.z = -Math.PI / 2
  beak.position.set(0.4, 0.02, 0)
  birdBody.add(beak)
  birdBody.position.y = 0.42
  birdGroup.add(birdBody)
  birdGroup.position.set(6, 2.6, -4)
  group.add(birdGroup)

  // ---- squirrel: body + tail + a nut, bobs in a munching loop ----
  const squirrelGroup = new THREE.Group()
  const sBody = toonMesh(new THREE.SphereGeometry(0.4, 10, 8), '#a0652f')
  squirrelGroup.add(sBody)
  const tail = toonMesh(new THREE.SphereGeometry(0.34, 8, 8), '#a0652f')
  tail.userData.mesh.scale.set(0.7, 1.4, 0.7)
  tail.userData.outline.scale.multiplyScalar(0.7)
  tail.position.set(-0.45, 0.35, 0)
  tail.rotation.z = 0.4
  squirrelGroup.add(tail)
  const nut = toonMesh(new THREE.SphereGeometry(0.1, 6, 6), '#7a5230')
  nut.position.set(0.38, 0.05, 0)
  squirrelGroup.add(nut)
  squirrelGroup.position.set(-7, 0.4, 5)
  squirrelGroup.rotation.y = 0.6
  group.add(squirrelGroup)

  return { group, ground, blades, bladeBase, dummy, sunflowers, birdGroup, squirrelGroup, nut }
}

export function updateEarth(earth, { progress, elapsed, T }) {
  const v = bell(progress, ...T.earthScene)
  earth.group.visible = v > 0.001
  if (v <= 0.001) return

  // grass sway: re-derive each instance's rotation with a sine offset on Z
  const { blades, bladeBase, dummy } = earth
  for (let i = 0; i < bladeBase.length; i++) {
    const b = bladeBase[i]
    dummy.position.set(b.x, 0, b.z)
    dummy.rotation.set(Math.sin(elapsed * b.speed + b.phase) * 0.18, b.rotY, 0)
    dummy.scale.setScalar(b.s)
    dummy.updateMatrix()
    blades.setMatrixAt(i, dummy.matrix)
  }
  blades.instanceMatrix.needsUpdate = true

  // sunflowers sway as whole groups
  earth.sunflowers.forEach((f) => {
    f.rotation.z = Math.sin(elapsed * f.userData.speed + f.userData.phase) * 0.08
  })

  // bird flips direction on the twig every ~3s
  const facing = Math.floor(elapsed / 3) % 2 === 0 ? 1 : -1
  earth.birdGroup.scale.x = facing

  // squirrel munching bob
  const bob = 1 + Math.sin(elapsed * 6) * 0.06
  earth.squirrelGroup.scale.set(bob, 1 / bob, bob)
  earth.nut.position.y = 0.05 + Math.max(0, Math.sin(elapsed * 6)) * 0.03
}
