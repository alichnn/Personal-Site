<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
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
})

function toggle() {
  ui.sound = !ui.sound
  soundscape.setEnabled(ui.sound)
}

useFrame(() => soundscape.update())
onBeforeUnmount(() => {
  stopListening()
  soundscape.setEnabled(false)
})
</script>

<template>
  <button
    type="button"
    class="icon-btn sound-toggle"
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
}
</style>
