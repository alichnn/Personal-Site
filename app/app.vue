<template>
  <div>
    <Experience :progress="progress" />

    <div id="overlay">
      <div class="layer" id="layer-hero" :style="heroStyle">
        <div class="hero-copy">
          <h1>Hey</h1>
          <h1>I'm Alice</h1>
        </div>
        <div class="hero-photo">
          <img src="/images/main_pic.JPG" alt="Alice">
        </div>
      </div>
    </div>

    <div id="scroll-hint" :style="{ opacity: 1 - ramp(progress, 0, 0.025) }">scroll</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useScrollProgress } from './composables/useScrollProgress'
import { ramp } from './utils/easing'

const { progress } = useScrollProgress()

const heroFade = [0.03, 0.07]
function layerStyle(v) {
  return {
    opacity: v,
    filter: `blur(${(1 - v) * 12}px)`,
    transform: `translateY(${(1 - v) * 16}px)`,
    pointerEvents: v > 0.6 ? 'auto' : 'none',
  }
}
const heroStyle = computed(() => layerStyle(1 - ramp(progress.value, ...heroFade)))
</script>

<style>
#layer-hero { flex-direction: row; gap: 5rem; }
.hero-copy { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 1.5rem; }
.hero-copy h1 { font-size: 5rem; text-shadow: 0 2px 18px rgba(20, 50, 90, 0.35); }
.hero-photo {
  flex-shrink: 0;
  width: clamp(140px, 16vw, 220px);
  aspect-ratio: 2 / 3;
  padding: 6px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 24px rgba(20, 50, 90, 0.25);
}
.hero-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }

@media (max-width: 640px) {
  .hero-copy h1 { font-size: 2.75rem; }
  #layer-hero { flex-direction: column; gap: 2rem; }
}
</style>
