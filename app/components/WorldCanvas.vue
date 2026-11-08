<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { World } from '~/core/world'
import { roles } from '~/data/content'
import { ui } from '~/composables/useStory'

const canvas = ref<HTMLCanvasElement | null>(null)
const fade = ref<HTMLCanvasElement | null>(null)
const css = ref<HTMLDivElement | null>(null)
let instance: World | null = null

onMounted(() => {
  try {
    create()
  } catch (err) {
    // No WebGL: fall back to a plain, static page (see .no-webgl in main.css).
    console.warn('3D unavailable, showing the static page.', err)
    document.documentElement.classList.add('no-webgl')
    ui.ready = true
  }
})

function create() {
  instance = new World({
    canvas: canvas.value!,
    cssLayer: css.value!,
    fadeCanvas: fade.value!,
    reduced: ui.reduced,
    roleCount: roles.length,
    onLoadProgress: (f) => (ui.loadProgress = f),
    onReady: () => (ui.ready = true),
    onTier: (t) => (ui.tier = t),
  })
  void instance.start()
}

onBeforeUnmount(() => instance?.dispose())
</script>

<template>
  <div class="world" aria-hidden="true">
    <canvas ref="canvas" class="world-canvas" />
    <canvas ref="fade" class="world-fade" />
    <div ref="css" class="world-css" />
  </div>
</template>
