import * as THREE from 'three'

// A 3-step gradient map gives MeshToonMaterial its flat, cel-shaded banding.
let gradientTex = null
export function toonGradient() {
  if (gradientTex) return gradientTex
  const size = 4
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  const shades = [80, 150, 210, 255]
  shades.forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(i, 0, 1, 1)
  })
  gradientTex = new THREE.CanvasTexture(canvas)
  gradientTex.minFilter = THREE.NearestFilter
  gradientTex.magFilter = THREE.NearestFilter
  gradientTex.generateMipmaps = false
  return gradientTex
}

export function toonMaterial(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    ...opts,
  })
}

// Classic inverted-hull outline: a slightly larger, back-face-only black
// shell rendered around a mesh. Returns the outline mesh; caller adds both
// the original mesh and this outline to the scene (or groups them).
export function addOutline(mesh, { thickness = 0.04, color = '#15110d' } = {}) {
  const outlineMat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  const outline = new THREE.Mesh(mesh.geometry, outlineMat)
  outline.scale.copy(mesh.scale).multiplyScalar(1 + thickness)
  outline.position.copy(mesh.position)
  outline.rotation.copy(mesh.rotation)
  return outline
}

// Convenience: build mesh + outline as a single group positioned at the origin,
// so callers can just position/rotate the returned group.
export function toonMesh(geometry, color, outlineOpts = {}) {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, toonMaterial(color))
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: outlineOpts.color ?? '#15110d',
    side: THREE.BackSide,
  }))
  const thickness = outlineOpts.thickness ?? 0.04
  outline.scale.setScalar(1 + thickness)
  group.add(outline, mesh)
  group.userData.mesh = mesh
  group.userData.outline = outline
  return group
}
