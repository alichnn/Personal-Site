<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { state } from '~/core/state'
import { LANTERN_REST, T, smooth } from '~/core/timeline'
import { scrollToProgress } from '~/core/scroll'
import { world } from '~/core/world'
import { projects, TYPES } from '~/data/projects'
import { openProject, projectUi } from '~/composables/useProjects'
import { ui, useFrame } from '~/composables/useStory'

// The lanterns' HTML: one real <button> over each 3D lantern (scenes/lanterns.ts), carrying its
// glowing title, so they're keyboard-focusable in left-to-right order and have proper names.
// Positions are written straight to the DOM each frame; nothing here is reactive per frame.

const HINT_MS = 6000

const layer = ref<HTMLElement | null>(null)
const buttons = ref<HTMLButtonElement[]>([])
const hint = ref<HTMLElement | null>(null)
/** Buttons take clicks only during the plateau. */
const live = ref(false)
const hintShown = ref(false)
const touch = ref(false)
let pulsed = false
let hintTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => (touch.value = matchMedia('(hover: none)').matches))

function dismissHint() {
  hintShown.value = false
  if (hintTimer) clearTimeout(hintTimer)
}

useFrame(() => {
  const w = world
  const el = layer.value
  if (!w || !el || !w.lanterns.built) return
  const p = state.p
  const [a, b, c, d] = T.lanterns
  const vis = Math.min(smooth(p, a, b), 1 - smooth(p, c, d))
  el.style.opacity = vis.toFixed(3)
  const isLive = vis > 0.5 && !ui.projectOpen
  if (isLive !== live.value) live.value = isLive

  let low = 0, sumX = 0, n = 0
  w.lanterns.screen.forEach((sc, i) => {
    const btn = buttons.value[i]
    if (!btn) return
    btn.classList.toggle('on', sc.on)
    if (!sc.on) return
    btn.style.transform = `translate(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px)`
    btn.style.setProperty('--r', `${Math.max(22, sc.r).toFixed(1)}px`)
    btn.style.setProperty('--lift', `${(sc.top - sc.y).toFixed(1)}px`)
    low = Math.max(low, sc.y + sc.r)
    sumX += sc.x
    n++
  })

  // when the plateau begins: the first lantern pulses once, and a quiet hint appears beneath the arc
  if (!pulsed && p >= b && p <= c && n > 0) {
    pulsed = true
    state.lanternUi.pulseAt = state.time
    state.lanternUi.pulseIndex = 0
    hintShown.value = true
    hintTimer = setTimeout(dismissHint, HINT_MS)
  }
  if (hint.value && n > 0) hint.value.style.transform = `translate(${(sumX / n).toFixed(1)}px, ${(low + 26).toFixed(1)}px)`
})

function enter(i: number) {
  state.lanternUi.hover = i
  dismissHint()
}
function leave(i: number) {
  if (state.lanternUi.hover === i) state.lanternUi.hover = -1
}
function focusIn(i: number) {
  enter(i)
  // like the story text, a lantern stays focusable off-plateau: tabbing to it brings the pond back
  const p = state.p
  if (p < T.lanterns[1] || p > T.lanterns[2]) scrollToProgress(LANTERN_REST, ui.reduced)
}
function click(i: number, e: MouseEvent) {
  dismissHint()
  if (projectUi.index >= 0) return
  openProject(i, e.currentTarget as HTMLElement)
}
</script>

<template>
  <div ref="layer" class="lantern-layer" :class="{ live }">
    <h2 class="sr-only">Projects</h2>
    <button
      v-for="(proj, i) in projects"
      :key="proj.slug"
      ref="buttons"
      type="button"
      class="lantern-btn"
      :style="{ '--glow': TYPES[proj.type].glow }"
      :aria-label="`Open project: ${proj.title}, ${TYPES[proj.type].label}`"
      @pointerenter="enter(i)"
      @pointerleave="leave(i)"
      @focus="focusIn(i)"
      @blur="leave(i)"
      @click="click(i, $event)"
    >
      <span class="lantern-hit" aria-hidden="true" />
      <span class="lantern-title" aria-hidden="true">
        <span class="lantern-name">{{ proj.title }}</span>
        <span class="lantern-type">{{ TYPES[proj.type].label }}</span>
      </span>
    </button>
    <p ref="hint" class="lantern-hint" :class="{ shown: hintShown && live }" aria-hidden="true">
      {{ touch ? 'Tap' : 'Click' }} a lantern to open a project
    </p>
  </div>
</template>

<style scoped>
.lantern-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
.lantern-btn {
  --r: 40px;
  --lift: -60px;
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
.lantern-btn.on {
  opacity: 1;
}
.live .lantern-btn.on {
  pointer-events: auto;
}
.lantern-btn:focus-visible {
  outline: none;
}
/* the clickable circle over the 3D lantern; the lantern itself does the glowing */
.lantern-hit {
  position: absolute;
  left: calc(-1 * var(--r));
  top: calc(-1 * var(--r));
  width: calc(2 * var(--r));
  height: calc(2 * var(--r));
  border-radius: 50%;
}
.lantern-btn:focus-visible .lantern-hit {
  outline: 2px solid var(--focus);
  outline-offset: 4px;
}
/* the title floats just above the lantern, with a soft dark halo so it reads over bright water */
.lantern-title {
  position: absolute;
  left: 0;
  top: var(--lift);
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  width: max-content;
  max-width: min(38vw, 15rem);
  padding: 0.35rem 0.8rem 0.4rem;
  transform: translate(-50%, -100%);
  text-align: center;
}
.lantern-title::before {
  content: '';
  position: absolute;
  inset: -4px -10px;
  z-index: -1;
  border-radius: 999px;
  background: radial-gradient(closest-side, rgba(16, 9, 6, 0.6), rgba(16, 9, 6, 0.32) 60%, transparent);
  filter: blur(6px);
}
.lantern-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  line-height: 1.15;
  color: #fff7ea;
  text-shadow: 0 0 2px rgba(20, 10, 6, 0.9), 0 0 14px var(--glow), 0 0 4px rgba(20, 10, 6, 0.7);
  text-wrap: balance;
}
.lantern-type {
  font-size: 0.74rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fff0d8;
  text-shadow: 0 0 2px rgba(20, 10, 6, 0.95), 0 0 10px rgba(20, 10, 6, 0.6);
}
.lantern-type::before {
  content: '';
  display: inline-block;
  width: 0.5em;
  height: 0.5em;
  margin-right: 0.5em;
  vertical-align: 0.08em;
  border-radius: 50%;
  background: var(--glow);
  box-shadow: 0 0 8px var(--glow);
}
.lantern-btn:hover .lantern-name,
.lantern-btn:focus-visible .lantern-name {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.2em;
}
.lantern-btn:focus-visible .lantern-title {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: 10px;
}
.lantern-hint {
  position: absolute;
  left: 0;
  top: 0;
  margin: 0;
  width: max-content;
  translate: -50% 0;
  font-style: italic;
  font-size: 1rem;
  color: rgba(255, 244, 226, 0.92);
  text-shadow: 0 0 3px rgba(20, 10, 6, 0.9), 0 0 14px rgba(20, 10, 6, 0.6);
  opacity: 0;
  transition: opacity 0.8s ease;
}
.lantern-hint.shown {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .lantern-btn,
  .lantern-hint {
    transition: none;
  }
}
</style>
