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

      <div class="layer" id="layer-fog" :style="fogStyle">
        <p>I spend most of my time thinking about people.</p>
      </div>

      <div class="layer" id="layer-goal" :style="goalStyle">
        <p>A life-long goal</p>
        <p class="indent">is to make meaningful connections</p>
      </div>
    </div>

    <div id="scroll-hint" :style="{ opacity: 1 - ramp(progress, 0, 0.025) }">scroll</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useScrollProgress } from './composables/useScrollProgress'
import { ramp, bell } from './utils/easing'
import { T } from './utils/timeline'

const { progress } = useScrollProgress()

function layerStyle(v) {
  return {
    opacity: v,
    filter: `blur(${(1 - v) * 12}px)`,
    transform: `translateY(${(1 - v) * 16}px)`,
    pointerEvents: v > 0.6 ? 'auto' : 'none',
  }
}
const heroStyle = computed(() => layerStyle(1 - ramp(progress.value, ...T.heroFade)))
const fogStyle = computed(() => layerStyle(bell(progress.value, ...T.fog)))
const goalStyle = computed(() => layerStyle(bell(progress.value, ...T.goal)))
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

#layer-fog p, #layer-goal p {
  text-shadow: 0 2px 14px rgba(10, 14, 30, 0.6);
}
#layer-goal p.indent { margin-left: 2.5rem; font-size: 1.6rem; }
#layer-goal p:first-child { font-size: 1.6rem; }

@media (max-width: 640px) {
  .hero-copy h1 { font-size: 2.75rem; }
  #layer-hero { flex-direction: column; gap: 2rem; }
}
</style>
