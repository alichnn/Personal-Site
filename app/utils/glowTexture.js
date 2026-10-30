import * as THREE from 'three'

// A soft round sprite for Points systems - without this, THREE.PointsMaterial
// renders every point as a flat square, not a dot/glow.
let tex = null
export function makeGlowTexture() {
  if (tex) return tex
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  tex = new THREE.CanvasTexture(c)
  return tex
}
