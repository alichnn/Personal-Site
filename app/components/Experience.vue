<template>
  <canvas ref="canvasEl" class="scene-canvas"></canvas>
</template>

<script setup>
import * as THREE from 'three'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { buildCameraPath } from '../utils/cameraPath'
import { ramp } from '../utils/easing'
import { buildAir, updateAir } from '../scenes/air'
import { buildEarth, updateEarth } from '../scenes/earth'
import { T } from '../utils/timeline'

const props = defineProps({
  progress: { type: Number, required: true },
})

// ---------- atmosphere color ramp ----------
const zoneStops = [
  { t: 0.00, color: new THREE.Color('#4a8fd6') },
  { t: 0.14, color: new THREE.Color('#4a8fd6') },
  { t: 0.24, color: new THREE.Color('#080b16') },
  { t: 0.34, color: new THREE.Color('#a9ddf0') },
  { t: 0.58, color: new THREE.Color('#a9ddf0') },
]
function zoneColorAt(t) {
  for (let i = 0; i < zoneStops.length - 1; i++) {
    const a = zoneStops[i], b = zoneStops[i + 1]
    if (t >= a.t && t <= b.t) {
      const local = (t - a.t) / (b.t - a.t || 1)
      return a.color.clone().lerp(b.color, local)
    }
  }
  return zoneStops[zoneStops.length - 1].color.clone()
}

const canvasEl = ref(null)
let renderer, scene, camera, rafId
let resizeHandler

onMounted(() => {
  const canvas = canvasEl.value
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400)

  const path = buildCameraPath()
  const camPos = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const tmpForward = new THREE.Vector3()

  scene.background = new THREE.Color('#4a8fd6')
  scene.fog = new THREE.FogExp2('#4a8fd6', 0.018)

  const ambient = new THREE.AmbientLight('#ffffff', 0.8)
  scene.add(ambient)
  const keyLight = new THREE.PointLight('#ffffff', 1.1, 120)
  scene.add(keyLight)

  const air = buildAir(scene)
  const earth = buildEarth(scene)
  const clock = new THREE.Clock()

  resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', resizeHandler)

  function frame() {
    const p = props.progress
    const elapsed = clock.getElapsedTime()

    camPos.copy(path.getPointAt(p))
    camera.position.copy(camPos)
    const aheadT = Math.min(1, p + 0.015)
    lookTarget.copy(path.getPointAt(aheadT))
    camera.lookAt(lookTarget)
    tmpForward.copy(lookTarget).sub(camPos).normalize()

    const zc = zoneColorAt(p)
    scene.background.copy(zc)
    scene.fog.color.copy(zc)
    keyLight.color.copy(zc).lerp(new THREE.Color('#ffffff'), 0.5)

    updateAir(air, { progress: p, elapsed, camPos, tmpForward, T })
    updateEarth(earth, { progress: p, elapsed, T })

    renderer.render(scene, camera)
    rafId = requestAnimationFrame(frame)
  }
  frame()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resizeHandler)
  renderer?.dispose()
})
</script>

<style scoped>
.scene-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
  z-index: 0;
}
</style>
