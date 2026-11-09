<script setup lang="ts">
import { computed, ref } from 'vue'
import { state } from '~/core/state'
import { ui, useFrame } from '~/composables/useStory'

// The loader is part of the world: the camera pushes into the cloud bank behind this text
// while the opening scenes build. Then it becomes a quiet "scroll" cue.

const pct = computed(() => Math.round(ui.loadProgress * 100))
const hint = ref<HTMLElement | null>(null)

useFrame(() => {
  if (!hint.value) return
  const a = ui.ready ? Math.max(0, 1 - state.p / 0.012) : 0
  hint.value.style.opacity = a.toFixed(3)
})
</script>

<template>
  <div class="loader" :class="{ done: ui.ready }" role="status" aria-live="polite">
    <p class="loader-text">
      <span v-if="!ui.ready">Gathering clouds… {{ pct }}%</span>
      <span v-else class="sr-only">Loaded. Scroll to begin.</span>
    </p>
    <div class="loader-bar" aria-hidden="true"><span :style="{ transform: `scaleX(${ui.loadProgress})` }" /></div>
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
}
</style>
