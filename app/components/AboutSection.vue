<script setup lang="ts">
import { animate } from 'animejs'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { T, damp } from '~/core/timeline'
import { state } from '~/core/state'
import { getScroll } from '~/core/scroll'
import { about } from '~/data/content'
import { albums } from '~/data/albums'
import { ui, useFrame } from '~/composables/useStory'
import AlbumCard from './AlbumCard.vue'

const TILTS = [-2, 1, -1, 1.5]
const compact = ref(false)
const inner = ref<HTMLElement | null>(null)
const cards = ref<InstanceType<typeof AlbumCard>[]>([])
const expanded = ref<number | null>(null)
const modal = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
/** Browsing state (no reactivity needed: read each frame). */
const browse = { hovering: false, focused: false }
let opener: HTMLElement | null = null

let mq: MediaQueryList | null = null
const onMq = () => (compact.value = !!mq?.matches)
onMounted(() => {
  mq = matchMedia('(max-width: 640px)')
  onMq()
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => mq?.removeEventListener('change', onMq))

useFrame(() => {
  if (!ui.albumsNear && state.p > 0.76) ui.albumsNear = true
  const inRange = state.p > T.about[0] && state.p < T.about[3]
  // hold the camera still while someone is browsing
  const browsing = inRange && (browse.hovering || browse.focused || expanded.value !== null)
  state.holdCamera = damp(state.holdCamera, browsing ? 1 : 0, 4, state.dt)
  if (!inRange || !inner.value) return

  // the cards catch the campfire: glow on the edge that faces the fire, flickering with it
  const fire = state.fireFlicker
  inner.value.style.setProperty('--fire', fire.toFixed(3))
  const els = [...cards.value.map((c) => c?.root), expanded.value !== null ? modal.value?.querySelector<HTMLElement>('.album') : null]
  for (const el of els) {
    if (!el) continue
    const r = el.getBoundingClientRect()
    const fx = state.fireScreen.visible ? state.fireScreen.x : innerWidth * 0.75
    const fy = state.fireScreen.visible ? state.fireScreen.y : innerHeight * 0.6
    const dx = fx - (r.left + r.width / 2), dy = fy - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy) || 1
    el.style.setProperty('--fire', fire.toFixed(3))
    el.style.setProperty('--fire-angle', `${((Math.atan2(dx, -dy) * 180) / Math.PI).toFixed(1)}deg`)
    el.style.setProperty('--fire-dx', (dx / len).toFixed(3))
    el.style.setProperty('--fire-dy', (dy / len).toFixed(3))
  }
})

async function open(i: number, from: HTMLElement) {
  opener = from
  expanded.value = i
  ui.albumOpen = true
  getScroll()?.stop()
  await nextTick()
  closeBtn.value?.focus()
  const card = modal.value?.querySelector('.album')
  if (card && !ui.reduced) animate(card, { scale: [0.7, 1], opacity: [0, 1], duration: 380, ease: 'outBack(1.4)' })
}

function close() {
  expanded.value = null
  ui.albumOpen = false
  getScroll()?.start()
  opener?.querySelector<HTMLElement>('.album-window')?.focus()
}

function trapTab(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !modal.value) return
  const f = [...modal.value.querySelectorAll<HTMLElement>('button, [tabindex="0"]')]
  if (!f.length) return
  const first = f[0]!, last = f[f.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <TextBlock :range="T.about" label="About Me" class="about">
    <div ref="inner" class="about-inner">
      <!-- the lettering floats in the firelight here (scenes/words.ts) -->
      <div class="about-copy">
        <h2 class="ghost headline">About Me</h2>
        <p class="ghost">{{ about }}</p>
      </div>
      <div
        class="albums"
        @pointerenter="browse.hovering = true"
        @pointerleave="browse.hovering = false"
        @focusin="browse.focused = true"
        @focusout="browse.focused = false"
      >
        <h3 class="sr-only">Hobbies</h3>
        <AlbumCard
          v-for="(a, i) in albums"
          :key="a.id"
          ref="cards"
          :album="a"
          :tilt="compact ? 0 : TILTS[i % TILTS.length]!"
          :compact="compact"
          :load="ui.albumsNear"
          @expand="open(i, $event)"
        />
      </div>
    </div>
    <div
      v-if="expanded !== null"
      ref="modal"
      class="album-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="`${albums[expanded]!.name} album`"
      @click.self="close"
      @keydown.esc="close"
      @keydown="trapTab"
    >
      <button ref="closeBtn" type="button" class="icon-btn modal-close" aria-label="Close album" @click="close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
      </button>
      <AlbumCard :album="albums[expanded]!" :tilt="0" class="modal-card" />
    </div>
  </TextBlock>
</template>

<style scoped>
.about {
  align-items: flex-start;
  justify-content: center;
}
.about-inner {
  --fire: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(2rem, 6.5vh, 3.6rem);
  width: min(1000px, 70vw);
  margin-left: 2vw;
}
.about-copy {
  align-self: flex-start;
  max-width: 34rem;
  text-align: left;
}
.about-copy h2 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.6rem, 3.4vw, 2.5rem);
  line-height: 1.1;
}
.about-copy p {
  margin: 0;
  font-size: clamp(1.2rem, 1.8vw, 1.35rem);
  line-height: 1.35;
}
.albums {
  /* four polaroids in a row, sized so the last one stops short of the campfire */
  --card-w: clamp(132px, min(13vw, 27vh), 208px);
  display: flex;
  flex-wrap: nowrap;
  gap: clamp(1.1rem, 2.8vw, 2.6rem);
  align-items: flex-start;
}
.album-modal {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(6, 4, 10, 0.55);
  --card-w: min(80vw, 46vh);
}
.modal-close {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  right: 16px;
}

@media (max-width: 640px) {
  .about {
    justify-content: space-between;
    padding-top: max(10vh, 56px);
    padding-bottom: max(9vh, 72px);
  }
  .about-inner {
    display: contents;
  }
  .about-copy {
    align-self: stretch;
    max-width: none;
  }
  .albums {
    /* phones: a 2 × 2 stack, so each polaroid stays big enough to see */
    --card-w: min(calc((100vw - 56px - 1rem) / 2), 21vh);
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    align-self: center;
  }
}
</style>
