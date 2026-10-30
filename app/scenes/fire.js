import * as THREE from 'three'
import { toonMaterial } from '../utils/toon'
import { ramp } from '../utils/easing'

function makeGlowTexture(hex) {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.5, 'rgba(255,200,120,0.35)')
  g.addColorStop(1, 'rgba(255,140,60,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(c)
}

export function buildFire(scene) {
  const group = new THREE.Group()
  group.position.set(0, -2.6, -152)
  scene.add(group)

  // stones ring
  const stoneMat = toonMaterial('#8a8a88')
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), stoneMat)
    stone.position.set(Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8)
    group.add(stone)
  }

  // logs
  const logMat = toonMaterial('#5a3a22')
  const logGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.4, 6)
  const log1 = new THREE.Mesh(logGeo, logMat)
  log1.rotation.z = Math.PI / 2
  log1.rotation.y = 0.3
  log1.position.y = 0.2
  group.add(log1)
  const log2 = log1.clone()
  log2.rotation.y = -0.5
  log2.position.y = 0.4
  group.add(log2)

  // flame glow sprite
  const glowTex = makeGlowTexture()
  const flameMat = new THREE.SpriteMaterial({
    map: glowTex, color: '#ff8a3d', transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const flame = new THREE.Sprite(flameMat)
  flame.position.y = 0.9
  flame.scale.set(2.2, 2.6, 1)
  group.add(flame)

  const fireLight = new THREE.PointLight('#ff9d4d', 2.5, 18)
  fireLight.position.y = 1.2
  group.add(fireLight)

  return { group, flame, flameMat, fireLight, anchor: group.position }
}

export function updateFire(fire, { progress, elapsed, T }) {
  const v = ramp(progress, ...T.fireIn)
  fire.group.visible = v > 0.001
  if (v <= 0.001) return

  const flicker = 0.85 + Math.sin(elapsed * 8) * 0.1 + Math.sin(elapsed * 13.7) * 0.05
  fire.flame.scale.set(2.2 * flicker, 2.6 * flicker, 1)
  fire.flameMat.opacity = v
  fire.fireLight.intensity = 2.5 * flicker * v
}
