<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { state } from '~/core/state'
import { SECTIONS, T, sectionAt } from '~/core/timeline'
import { flyToProgress } from '~/core/scroll'
import { ui, useFrame } from '~/composables/useStory'

// The chapter legend: a quiet, right-aligned column of small capitals in the top-right corner.
// The current chapter is set in bold with a fine dash in the margin beside it. It appears with the hero greeting and
// fades away when the visitor has been still for a few seconds, returning on any movement.

const IDLE_MS = 3000
const ACTIVITY = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const

const active = ref(0)
const inStory = ref(false)
const awake = ref(true)
/** Pointer over the legend or keyboard focus inside it: never fade then. */
const engaged = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function wake() {
  awake.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (awake.value = false), IDLE_MS)
}

onMounted(() => {
  for (const e of ACTIVITY) addEventListener(e, wake, { passive: true, capture: true })
  wake()
})
onBeforeUnmount(() => {
  for (const e of ACTIVITY) removeEventListener(e, wake, { capture: true })
  if (timer) clearTimeout(timer)
})

useFrame(() => {
  const p = state.p
  inStory.value = p >= T.hero[0]
  active.value = sectionAt(p)
})

const go = (i: number) => flyToProgress(SECTIONS[i]!.to, ui.reduced)
</script>

<template>
  <nav
    class="legend"
    :class="{ shown: inStory && !ui.albumOpen && (awake || engaged) }"
    aria-label="Sections"
    @pointerenter="engaged = true"
    @pointerleave="engaged = false"
    @focusin="engaged = true"
    @focusout="engaged = false"
  >
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
.legend {
  position: fixed;
  top: max(26px, env(safe-area-inset-top));
  right: max(40px, env(safe-area-inset-right));
  z-index: 12;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.9s ease;
}
.legend.shown {
  opacity: 1;
  pointer-events: auto;
  transition-duration: 0.45s;
}
ul {
  display: grid;
  justify-items: end;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
button {
  position: relative;
  appearance: none;
  border: 0;
  padding: 0.2rem 0;
  background: none;
  /* translucent ivory: present but quiet; the current chapter a little stronger */
  color: rgba(246, 238, 221, 0.4);
  font-family: 'Cormorant Garamond', 'Cormorant', Garamond, 'Times New Roman', serif;
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  text-align: right;
  white-space: nowrap;
  /* a faint halo only: a hard shadow would show through the translucent letters and grey them */
  text-shadow: 0 0 12px rgba(10, 14, 34, 0.22);
  cursor: pointer;
  transition: color 0.3s ease;
}
/* the fine dash sits in the right margin, so the words never shift and the dashes line up */
button::before {
  content: '';
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  width: 16px;
  height: 1px;
  background: currentColor;
  box-shadow: 0 0 6px rgba(10, 14, 34, 0.4);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.35s ease;
}
button:hover {
  color: rgba(246, 238, 221, 0.55);
}
button.active {
  font-weight: 700;
  color: rgba(246, 238, 221, 0.6);
}
button.active::before {
  transform: scaleX(1);
}
button:hover::before {
  transform: scaleX(0.55);
}
button.active:hover::before {
  transform: scaleX(1);
}
button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 4px;
}
@media (max-width: 640px) {
  .legend {
    top: max(16px, env(safe-area-inset-top));
    right: max(32px, env(safe-area-inset-right));
  }
  button {
    font-size: 0.86rem;
    letter-spacing: 0.2em;
  }
}
@media (prefers-reduced-motion: reduce) {
  .legend,
  button::before {
    transition: none;
  }
}
</style>
