<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { ui, useFrame } from '~/composables/useStory'
import { soundscape } from '~/core/audio'

// Ambient sound: off by default, one small persistent toggle.

function toggle() {
  ui.sound = !ui.sound
  soundscape.setEnabled(ui.sound)
}

useFrame(() => soundscape.update())
onBeforeUnmount(() => soundscape.setEnabled(false))
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
