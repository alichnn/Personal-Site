<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { state } from '~/core/state'
import { getScroll } from '~/core/scroll'
import { soundscape } from '~/core/audio'
import { ui, useFrame } from '~/composables/useStory'

// The loader is part of the world: the camera pushes into the cloud bank behind this text
// while the opening scenes build. Then it offers Enter: browsers only allow sound after a click,
// so that one click both unlocks scrolling and starts the soundscape. After that it becomes a
// quiet "scroll" cue.

const pct = computed(() => Math.round(ui.loadProgress * 100))
const hint = ref<HTMLElement | null>(null)

watch(
  () => ui.ready,
  (ready) => {
    // without WebGL there's no story to gate: just show the static page
    if (ready && document.documentElement.classList.contains('no-webgl')) enter(false)
  },
)

// Return or Space anywhere also enters (without parking a focus ring on the button)
function onKey(e: KeyboardEvent) {
  if (!ui.ready || ui.entered || (e.key !== 'Enter' && e.key !== ' ')) return
  if (e.target instanceof HTMLButtonElement) return
  e.preventDefault()
  enter()
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))

function enter(sound = true) {
  if (ui.entered) return
  ui.entered = true
  if (sound) {
    ui.sound = true
    soundscape.setEnabled(true)
  }
  getScroll()?.start()
}

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
  <div class="enter" :class="{ shown: ui.ready && !ui.entered }">
    <button type="button" class="enter-btn" aria-label="Enter, with sound on" :tabindex="ui.ready && !ui.entered ? 0 : -1" @click="enter()">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" />
        <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      Enter
    </button>
    <p class="enter-note" aria-hidden="true">with sound</p>
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
.enter {
  position: fixed;
  left: 0;
  right: 0;
  bottom: max(9vh, 56px);
  z-index: 11;
  width: max-content;
  margin: 0 auto;
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.enter.shown {
  opacity: 1;
  transform: none;
  pointer-events: auto;
  transition-delay: 0.5s;
}
.enter-btn {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.7rem;
  border: 1.5px solid rgba(23, 52, 94, 0.32);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 8px 28px rgba(23, 52, 94, 0.16);
  color: #17345e;
  font: 700 0.95rem/1 var(--font);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
}
.enter-btn svg {
  width: 20px;
  height: 20px;
}
.enter-btn:hover {
  background: rgba(255, 255, 255, 0.72);
  transform: translateY(-1px);
  box-shadow: 0 10px 32px rgba(23, 52, 94, 0.22);
}
.enter-btn:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.enter-note {
  margin: 0;
  color: rgba(23, 52, 94, 0.7);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.08em;
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
  .scroll-hint svg {
    animation: none;
  }
  .enter,
  .enter-btn {
    transition: none;
  }
}
</style>
