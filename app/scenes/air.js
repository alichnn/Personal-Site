import * as THREE from 'three'
import { ramp, bell } from '../utils/easing'
import { makeGlowTexture } from '../utils/glowTexture'

// A hand-drawn-looking cloud puff, built the same way the glow-sprite
// texture already is elsewhere in this project: draw it once on a canvas,
// use the canvas as a texture.
function makeCloudTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const blobs = [
    [128, 150, 70], [80, 160, 46], [176, 160, 46],
    [110, 120, 54], [146, 120, 54], [128, 110, 50],
  ]
  ctx.fillStyle = '#ffffff'
  for (const [x, y, r] of blobs) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  return tex
}

export function buildAir(scene) {
  const group = new THREE.Group()
  scene.add(group)

  // ---- racing cloud layer: a wide strip of cloud sprites that tiles ----
  const cloudTex = makeCloudTexture()
  cloudTex.wrapS = cloudTex.wrapT = THREE.ClampToEdgeWrapping
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false })
  const CLOUD_COUNT = 14
  const clouds = []
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const s = new THREE.Sprite(cloudMat)
    const scale = 6 + Math.random() * 7
    s.scale.set(scale * 1.6, scale, 1)
    s.userData.baseX = (i / CLOUD_COUNT) * 60 - 30 + (Math.random() - 0.5) * 4
    s.userData.y = 2 + Math.random() * 8
    s.userData.depth = 16 + Math.random() * 10
    group.add(s)
    clouds.push(s)
  }

  // ---- stars: a dome of points ahead of the camera, each blinking on its own phase ----
  const STAR_COUNT = 500
  const starPos = new Float32Array(STAR_COUNT * 3)
  const starColor = new Float32Array(STAR_COUNT * 3)
  const starPhase = new Float32Array(STAR_COUNT)
  const starSpeed = new Float32Array(STAR_COUNT)
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = (Math.random() - 0.5) * Math.PI * 0.9 // left-right spread
    const phi = Math.random() * Math.PI * 0.35 + 0.08 // mostly above horizon
    const r = 55
    starPos[i * 3 + 0] = Math.sin(theta) * r
    starPos[i * 3 + 1] = Math.sin(phi) * r * 1.1 + 4
    starPos[i * 3 + 2] = -Math.cos(theta) * Math.cos(phi) * r
    starColor[i * 3 + 0] = starColor[i * 3 + 1] = starColor[i * 3 + 2] = 1
    starPhase[i] = Math.random() * Math.PI * 2
    starSpeed[i] = 0.6 + Math.random() * 1.4
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColor, 3))
  const starMat = new THREE.PointsMaterial({
    map: makeGlowTexture(),
    size: 0.6, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const stars = new THREE.Points(starGeo, starMat)
  group.add(stars)

  return { group, clouds, cloudMat, stars, starMat, starPhase, starSpeed }
}

export function updateAir(air, { progress, elapsed, camPos, tmpForward, T }) {
  const { clouds, cloudMat, stars, starMat, starPhase, starSpeed } = air

  // clouds race by quickly (time-driven so they move even before scrolling),
  // then clear away (fade out) ahead of the night transition
  const driftSpeed = 2.4
  clouds.forEach((s) => {
    const x = ((s.userData.baseX + elapsed * driftSpeed) % 70) - 35
    s.position.copy(camPos)
      .addScaledVector(tmpForward, s.userData.depth)
    s.position.x += x
    s.position.y += s.userData.y
  })
  cloudMat.opacity = 1 - ramp(progress, ...T.cloudClear)

  // stars fade in as the sky darkens, then back out as Earth's daylight arrives
  const starV = bell(progress, ...T.starsIn)
  stars.position.copy(camPos)
  starMat.opacity = starV * 0.95
  if (starV > 0.001) {
    const colors = stars.geometry.attributes.color.array
    for (let i = 0; i < starPhase.length; i++) {
      const b = 0.55 + 0.45 * Math.sin(elapsed * starSpeed[i] + starPhase[i])
      colors[i * 3 + 0] = colors[i * 3 + 1] = colors[i * 3 + 2] = b
    }
    stars.geometry.attributes.color.needsUpdate = true
  }
}
