<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ui, useFrame } from '~/composables/useStory'
import { soundscape } from '~/core/audio'

// Ambient sound: on by default, one small persistent toggle. Browsers only start audio after a
// click, tap or keypress (scrolling doesn't count), so the soundscape starts at the first one.

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const

function unlock() {
  if (ui.sound) soundscape.setEnabled(true)
  // keep listening until the browser lets it play (or the visitor turned sound off)
  if (soundscape.running || !ui.sound) stopListening()
}
function stopListening() {
  for (const g of GESTURES) removeEventListener(g, unlock, true)
}
onMounted(() => {
  for (const g of GESTURES) addEventListener(g, unlock, true)
  addEventListener('pointermove', near, { passive: true })
})

// Out of the way until wanted: shown for a few seconds after the visitor enters (so they know it's
// there), then it fades and comes back whenever the cursor is near the corner or it has focus.
// Touch screens have no cursor, so there it rests as a faint ghost instead.
const RADIUS = 140
const HINT_MS = 4500
const btn = ref<HTMLButtonElement | null>(null)
const close = ref(false)
const hinting = ref(false)
const focused = ref(false)
let hintTimer: ReturnType<typeof setTimeout> | null = null
function near(e: PointerEvent) {
  if (e.pointerType === 'touch' || !btn.value) return
  const r = btn.value.getBoundingClientRect()
  close.value = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < RADIUS
}
watch(
  () => ui.entered,
  (on) => {
    if (!on) return
    hinting.value = true
    hintTimer = setTimeout(() => (hinting.value = false), HINT_MS)
  },
  { immediate: true },
)

function toggle() {
  ui.sound = !ui.sound
  soundscape.setEnabled(ui.sound)
}

useFrame(() => soundscape.update())
onBeforeUnmount(() => {
  removeEventListener('pointermove', near)
  if (hintTimer) clearTimeout(hintTimer)
  stopListening()
  soundscape.setEnabled(false)
})
</script>

<template>
  <button
    ref="btn"
    type="button"
    class="icon-btn sound-toggle"
    :class="{ shown: close || hinting || focused }"
    @focus="focused = true"
    @blur="focused = false"
    :aria-pressed="ui.sound"
    :aria-label="ui.sound ? 'Turn ambient sound off' : 'Turn ambient sound on'"
    :title="ui.sound ? 'Sound on' : 'Sound off'"
    @click="toggle"
  >
    <svg v-if="ui.sound" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped>
.sound-toggle {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 12;
  opacity: 0;
  transition: opacity 0.7s ease, background 0.2s ease;
}
.sound-toggle.shown {
  opacity: 1;
  transition-duration: 0.25s, 0.2s;
}
/* no cursor to bring it back: rest as a faint ghost that can still be tapped */
@media (hover: none) {
  .sound-toggle {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sound-toggle {
    transition: none;
  }
}
</style>
