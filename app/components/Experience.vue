<template>
  <canvas ref="canvasEl" class="scene-canvas"></canvas>
</template>

<script setup>
import * as THREE from 'three'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useScrollProgress } from '../composables/useScrollProgress'
import { buildCameraPath } from '../utils/cameraPath'
import { ramp } from '../utils/easing'

const props = defineProps({
  progress: { type: Number, required: true },
})

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
  const lookTarget = new THREE.Vector3()

  // placeholder atmosphere: blue -> dark -> blue, to prove the pipeline end to end
  // before the real scene modules land in the next phase
  const skyBlue = new THREE.Color('#4a8fd6')
  const night = new THREE.Color('#0a0e1a')
  scene.background = skyBlue.clone()
  scene.fog = new THREE.FogExp2('#4a8fd6', 0.018)

  const ambient = new THREE.AmbientLight('#ffffff', 0.8)
  scene.add(ambient)

  resizeHandler = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', resizeHandler)

  function frame() {
    const p = props.progress

    const camPos = path.getPointAt(p)
    camera.position.copy(camPos)
    const aheadT = Math.min(1, p + 0.015)
    lookTarget.copy(path.getPointAt(aheadT))
    camera.lookAt(lookTarget)

    const nightV = ramp(p, 0.10, 0.18)
    const c = skyBlue.clone().lerp(night, nightV)
    scene.background.copy(c)
    scene.fog.color.copy(c)

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
