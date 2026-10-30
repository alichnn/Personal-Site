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

      <div class="layer" id="layer-earth" :style="earthStyle">
        <p>
          I want to learn about human behaviour, strategize a mathematical
          formula, and cater to the subconscious.
        </p>
      </div>

      <div class="layer" id="layer-work" :style="workStyle">
        <h2>Work</h2>
        <ul class="work-list">
          <li>Fraud Mitigation</li>
          <li>Product Strategy</li>
          <li>Risk</li>
        </ul>
        <p>Under all of it, what I'm really passionate about is human intention and desire:</p>
        <ol class="passion-list">
          <li>Learning about human behaviour</li>
          <li>Formulating a path</li>
          <li>Catering to the subconscious</li>
        </ol>
      </div>

      <div class="layer" id="layer-about" :style="aboutStyle">
        <h2>About Me</h2>
        <div class="about-facts">
          <p><strong>Education:</strong> Math / BBA at UW / WLU</p>
          <p><strong>From:</strong> Markham, Ontario</p>
          <p><strong>Favorite place:</strong> Downtown Markham</p>
        </div>
        <div class="hobby-grid">
          <div class="hobby-card">Gym</div>
          <div class="hobby-card">Travel</div>
          <div class="hobby-card">Food</div>
          <div class="hobby-card">Friends</div>
        </div>
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
const earthStyle = computed(() => layerStyle(bell(progress.value, ...T.earthParagraph)))
const workStyle = computed(() => layerStyle(bell(progress.value, ...T.work)))
const aboutStyle = computed(() => layerStyle(bell(progress.value, ...T.about)))
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

#layer-earth p {
  color: #1d3a1a;
  text-shadow: none;
  background: rgba(255, 255, 255, 0.55);
  padding: 1.5rem 2rem;
  border-radius: 14px;
  font-size: 1.3rem;
  line-height: 1.6;
}

.work-list, .hobby-grid { list-style: none; }
.work-list {
  display: flex; gap: 1.25rem; flex-wrap: wrap; justify-content: center;
}
.work-list li {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.65rem 1.4rem;
  border-radius: 8px;
  font-weight: 600;
}
.passion-list { list-style: decimal; text-align: left; max-width: 460px; margin: 0 auto; }
.passion-list li { margin-bottom: 0.4rem; }

.about-facts { display: flex; flex-direction: column; gap: 0.6rem; font-size: 1.1rem; margin-bottom: 1.5rem; }
.about-facts strong { color: #9fd0f0; }

.hobby-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(140px, 200px));
  gap: 1.25rem;
}
.hobby-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 150, 90, 0.4);
  border-radius: 12px;
  padding: 1.6rem 1rem;
  font-size: 1.15rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .hero-copy h1 { font-size: 2.75rem; }
  #layer-hero { flex-direction: column; gap: 2rem; }
}
</style>
