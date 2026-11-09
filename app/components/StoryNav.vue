<script setup lang="ts">
import { ref } from 'vue'
import { state } from '~/core/state'
import { SECTIONS, T, sectionAt } from '~/core/timeline'
import { flyToProgress } from '~/core/scroll'
import { ui, useFrame } from '~/composables/useStory'

// Where you are: a frosted pill with the four chapters, the current one highlighted.
// Appears with the hero greeting.

const active = ref(0)
const shown = ref(false)

useFrame(() => {
  const p = state.p
  shown.value = p >= T.hero[0]
  active.value = sectionAt(p)
})

const go = (i: number) => flyToProgress(SECTIONS[i]!.to, ui.reduced)
</script>

<template>
  <nav class="story-nav" :class="{ shown: shown && !ui.albumOpen }" aria-label="Sections">
    <ul>
      <li v-for="(s, i) in SECTIONS" :key="s.label">
        <button type="button" :class="{ active: i === active }" :aria-current="i === active ? 'location' : undefined" @click="go(i)">
          {{ s.label }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.story-nav {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  z-index: 12;
  padding: 5px;
  border-radius: 22px;
  background: rgba(12, 18, 40, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 24px rgba(6, 10, 30, 0.18);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.story-nav.shown {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
ul {
  display: flex;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 8px 13px;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  font: 500 0.84rem/1 var(--font);
  letter-spacing: 0.01em;
  white-space: nowrap;
  cursor: pointer;
  text-shadow: 0 1px 6px rgba(6, 10, 30, 0.35);
  transition: background 0.25s ease, color 0.25s ease;
}
button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
button.active {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}
button:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 1px;
}
@media (max-width: 640px) {
  /* phones: centred across the top */
  .story-nav {
    top: max(12px, env(safe-area-inset-top));
    left: 0;
    right: 0;
    width: max-content;
    margin: 0 auto;
  }
  button {
    padding: 7px 10px;
    font-size: 0.78rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .story-nav,
  button {
    transition: none;
  }
}
</style>
