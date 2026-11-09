<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { state } from '~/core/state'
import { getScroll } from '~/core/scroll'
import { soundscape } from '~/core/audio'
import { ui, useFrame } from '~/composables/useStory'

// The loader is part of the world: the camera pushes into the cloud bank behind this text
// while the opening scenes build. Then a quiet CLICK appears: browsers only allow sound after a
// click, so that one click (anywhere) both starts the soundscape and unlocks scrolling. After
// that it becomes a quiet "scroll" cue.

const pct = computed(() => Math.round(ui.loadProgress * 100))
const hint = ref<HTMLElement | null>(null)
const asking = computed(() => ui.ready && !ui.entered)

function enter() {
  if (ui.entered) return
  ui.entered = true
  // respect a visitor who muted with the corner toggle before clicking in
  if (ui.sound) soundscape.setEnabled(true)
  getScroll()?.start()
}

watch(
  () => ui.ready,
  (ready) => {
    // without WebGL there's no story to gate: just show the static page
    if (ready && document.documentElement.classList.contains('no-webgl')) {
      ui.entered = true
    }
  },
)

// Return or Space also clicks in
function onKey(e: KeyboardEvent) {
  if (!asking.value || (e.key !== 'Enter' && e.key !== ' ')) return
  if (e.target instanceof HTMLButtonElement) return
  e.preventDefault()
  enter()
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))

useFrame(() => {
  if (!hint.value) return
  const a = ui.entered ? Math.max(0, 1 - state.p / 0.012) : 0
  hint.value.style.opacity = a.toFixed(3)
})
</script>

<template>
  <div class="loader" :class="{ done: ui.ready }" role="status" aria-live="polite">
    <p class="loader-text">
      <span v-if="!ui.ready">Gathering clouds… {{ pct }}%</span>
      <span v-else class="sr-only">Loaded.</span>
    </p>
    <div class="loader-bar" aria-hidden="true"><span :style="{ transform: `scaleX(${ui.loadProgress})` }" /></div>
  </div>
  <!-- the whole screen is the click target; the word is the button for keyboards and screen readers -->
  <div class="click-in" :class="{ shown: asking }" @click="enter">
    <button type="button" class="click-word" :tabindex="asking ? 0 : -1" aria-label="Click to begin, with sound" @click.stop="enter">Click</button>
  </div>
  <div ref="hint" class="scroll-hint" aria-hidden="true">
    <span>Scroll</span>
    <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </div>
</template>

<style scoped>
.loader {
  position: fixed;
  left: 50%;
  bottom: max(9vh, 56px);
  z-index: 10;
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  color: #17345e;
  transition: opacity 0.8s ease 0.2s;
  pointer-events: none;
}
.loader.done {
  opacity: 0;
}
.loader-text {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  font-weight: 600;
}
.loader-bar {
  width: 140px;
  height: 3px;
  border-radius: 3px;
  background: rgba(23, 52, 94, 0.18);
  overflow: hidden;
}
.loader-bar span {
  display: block;
  height: 100%;
  background: #17345e;
  transform-origin: 0 50%;
  transition: transform 0.4s ease;
}
.click-in {
  position: fixed;
  inset: 0;
  z-index: 11;
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.8s ease;
}
.click-in.shown {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 0.4s;
}
.click-word {
  appearance: none;
  border: 0;
  background: none;
  padding: 1rem 1.5rem;
  /* translucent navy: the opening view is bright cloud, where ivory would vanish */
  color: rgba(23, 52, 94, 0.55);
  font-family: 'Cormorant Garamond', 'Cormorant', Garamond, 'Times New Roman', serif;
  font-size: clamp(1.15rem, 1.6vw, 1.45rem);
  font-weight: 500;
  letter-spacing: 0.6em;
  /* balance the trailing letter-space so the word sits truly centred */
  text-indent: 0.6em;
  text-transform: uppercase;
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.6);
  cursor: pointer;
  animation: breathe 3.2s ease-in-out infinite;
  transition: color 0.3s ease;
}
.click-word:hover {
  color: rgba(23, 52, 94, 0.8);
}
.click-word:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 4px;
}
@keyframes breathe {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}
.scroll-hint {
  position: fixed;
  left: 50%;
  bottom: max(7vh, 40px);
  z-index: 9;
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  color: #17345e;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0;
  pointer-events: none;
}
.scroll-hint svg {
  width: 22px;
  height: 22px;
  animation: nudge 1.8s ease-in-out infinite;
}
@keyframes nudge {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-hint svg,
  .click-word {
    animation: none;
  }
  .click-in {
    transition: none;
  }
}
</style>
