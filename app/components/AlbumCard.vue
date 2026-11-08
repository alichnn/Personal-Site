<script setup lang="ts">
import { animate } from 'animejs'
import { computed, nextTick, ref, watch } from 'vue'
import { PHOTO_WIDTHS, type Album } from '~/data/albums'
import { ui } from '~/composables/useStory'

const props = defineProps<{
  album: Album
  /** Resting tilt in degrees. */
  tilt: number
  /** Phone row: photo and name only; tapping asks the parent to expand. */
  compact?: boolean
  /** Images load only once the visitor nears the campfire. */
  load?: boolean
}>()
const emit = defineEmits<{ expand: [el: HTMLElement] }>()

const index = ref(0)
const n = computed(() => props.album.photos.length)
const name = computed(() => props.album.name.toLowerCase())
const root = ref<HTMLElement | null>(null)
const haze = ref<HTMLElement | null>(null)
const live = ref('')

const wrap = (i: number) => ((i % n.value) + n.value) % n.value
/** Current photo plus its neighbours, so the next/previous image is always already loaded. */
const stack = computed(() => {
  const set = new Set([index.value, wrap(index.value + 1), wrap(index.value - 1)])
  return [...set].map((i) => ({ i, photo: props.album.photos[i]! }))
})

const srcset = (src: string, fmt: string) => PHOTO_WIDTHS.map((w) => `${src}-${w}.${fmt} ${w}w`).join(', ')
const sizes = computed(() => (props.compact ? '30vw' : '(max-width: 640px) 80vw, 240px'))

function go(dir: number, from?: HTMLElement) {
  if (n.value < 2) return
  index.value = wrap(index.value + dir)
  const photo = props.album.photos[index.value]!
  live.value = `${props.album.name} photo ${index.value + 1} of ${n.value}: ${photo.alt}`
  if (from) embers(from)
  void nextTick(develop)
}

/** The one signature effect: the new photo develops in from a warm haze. */
function develop() {
  const img = root.value?.querySelector<HTMLElement>('.photo.current img')
  if (!img || !haze.value) return
  if (ui.reduced) {
    animate(haze.value, { opacity: [0.6, 0], duration: 250, ease: 'linear' })
    return
  }
  animate(haze.value, { opacity: [0.85, 0], duration: 420, ease: 'outQuad' })
  animate(img, {
    filter: ['sepia(0.7) saturate(0.35) brightness(1.3) contrast(0.8)', 'sepia(0) saturate(1) brightness(1) contrast(1)'],
    duration: 420,
    ease: 'outQuad',
  })
}

/** Two or three tiny embers drift up off the card from the arrow. */
function embers(from: HTMLElement) {
  if (ui.reduced || !root.value) return
  const card = root.value.getBoundingClientRect()
  const b = from.getBoundingClientRect()
  const count = 2 + Math.round(Math.random())
  for (let k = 0; k < count; k++) {
    const e = document.createElement('span')
    e.className = 'ember'
    e.style.left = `${b.left - card.left + b.width / 2}px`
    e.style.top = `${b.top - card.top + b.height / 2}px`
    root.value.appendChild(e)
    animate(e, {
      translateY: [0, -50 - Math.random() * 45],
      translateX: [0, (Math.random() - 0.5) * 34],
      opacity: [1, 0],
      scale: [1, 0.3],
      duration: 900 + Math.random() * 500,
      delay: k * 70,
      ease: 'outQuad',
      onComplete: () => e.remove(),
    })
  }
}

function onKey(e: KeyboardEvent) {
  if (props.compact) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    go(1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    go(-1)
  }
}

// swipe on touch screens
let sx = 0, sy = 0, tracking = false
function down(e: PointerEvent) {
  if (props.compact) return
  tracking = true
  sx = e.clientX
  sy = e.clientY
}
function up(e: PointerEvent) {
  if (!tracking) return
  tracking = false
  const dx = e.clientX - sx, dy = e.clientY - sy
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1)
}

// resting tilt; straightens with a little lift when hovered or focused
function lift(on: boolean) {
  if (!root.value || props.compact) return
  animate(root.value, {
    rotate: on ? 0 : props.tilt,
    translateY: on ? -8 : 0,
    duration: ui.reduced ? 0 : 380,
    ease: on ? 'outBack(1.6)' : 'outQuad',
  })
}
watch(
  () => props.tilt,
  (t) => root.value && animate(root.value, { rotate: t, duration: 0 }),
)

function onClick() {
  if (props.compact && root.value) emit('expand', root.value)
}

defineExpose({ root })
</script>

<template>
  <div
    ref="root"
    class="album"
    :class="{ compact }"
    role="group"
    :aria-roledescription="compact ? undefined : 'photo album'"
    :aria-label="`${album.name} album`"
    :tabindex="compact ? -1 : 0"
    :style="{ transform: `rotate(${tilt}deg)` }"
    @keydown="onKey"
    @pointerenter="lift(true)"
    @pointerleave="lift(false)"
    @focusin="lift(true)"
    @focusout="lift(false)"
  >
    <component
      :is="compact ? 'button' : 'div'"
      class="album-window"
      :type="compact ? 'button' : undefined"
      :aria-label="compact ? `Open ${name} album` : undefined"
      @pointerdown="down"
      @pointerup="up"
      @pointercancel="tracking = false"
      @click="onClick"
    >
      <picture v-for="s in load === false ? [] : stack" :key="s.photo.src" class="photo" :class="{ current: s.i === index }">
        <source type="image/avif" :srcset="srcset(s.photo.src, 'avif')" :sizes="sizes">
        <source type="image/webp" :srcset="srcset(s.photo.src, 'webp')" :sizes="sizes">
        <img
          :src="`${s.photo.src}-400.webp`"
          :alt="s.i === index ? s.photo.alt : ''"
          :aria-hidden="s.i === index ? undefined : 'true'"
          width="400"
          height="500"
          decoding="async"
          draggable="false"
        >
      </picture>
      <span ref="haze" class="haze" aria-hidden="true" />
      <template v-if="!compact">
        <button type="button" class="arrow prev" :aria-label="`Previous ${name} photo`" @click.stop="go(-1, $event.currentTarget as HTMLElement)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <button type="button" class="arrow next" :aria-label="`Next ${name} photo`" @click.stop="go(1, $event.currentTarget as HTMLElement)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </template>
    </component>
    <div class="album-strip">
      <span class="album-name">{{ album.name }}</span>
      <span v-if="!compact" class="album-count" aria-hidden="true">{{ index + 1 }} / {{ n }}</span>
    </div>
    <p class="sr-only" aria-live="polite">{{ live }}</p>
  </div>
</template>

<style scoped>
.album {
  --fire: 0;
  --fire-angle: 90deg;
  --fire-dx: 0;
  --fire-dy: 0;
  position: relative;
  width: var(--card-w, 220px);
  padding: 9px 9px 0;
  border-radius: 6px;
  background: var(--card);
  color: var(--card-ink);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.38),
    calc(var(--fire-dx) * 14px) calc(var(--fire-dy) * 14px) 30px rgba(255, 120, 40, calc(var(--fire) * 0.42));
  text-align: left;
  transform-origin: 50% 60%;
  outline-offset: 5px;
}
/* the firelit edge */
.album::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(var(--fire-angle), transparent 50%, rgba(255, 140, 50, calc(var(--fire) * 0.32)) 100%);
  pointer-events: none;
}
.album-window {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 4 / 5;
  padding: 0;
  border: 0;
  border-radius: 2px;
  overflow: hidden;
  background: #2a2420;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  font: inherit;
  color: inherit;
}
button.album-window {
  cursor: zoom-in;
}
.photo,
.photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.photo img {
  object-fit: cover;
  display: block;
}
.photo {
  opacity: 0;
  z-index: 1;
}
.photo.current {
  opacity: 1;
  z-index: 2;
}
.haze {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: radial-gradient(circle at 50% 45%, #fff3dc, #f3d9b0);
  opacity: 0;
  pointer-events: none;
}
.arrow {
  position: absolute;
  z-index: 4;
  top: 50%;
  width: 40px;
  height: 40px;
  margin-top: -20px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 16, 10, 0.62);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
}
.arrow svg {
  width: 22px;
  height: 22px;
}
.arrow:hover {
  background: rgba(24, 16, 10, 0.82);
}
.arrow.prev {
  left: 6px;
}
.arrow.next {
  right: 6px;
}
.album:hover .arrow,
.album:focus-within .arrow,
.arrow:focus-visible {
  opacity: 1;
}
@media (hover: none) {
  .arrow {
    opacity: 1;
  }
}
.album-strip {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.7rem 0.25rem 0.85rem;
  min-height: 3.4rem;
}
.album-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.05rem;
}
.album-count {
  font-size: 0.85rem;
  color: #5a4637;
  font-variant-numeric: tabular-nums;
}
.album.compact {
  padding: 6px 6px 0;
}
.album.compact .album-strip {
  min-height: 0;
  padding: 0.45rem 0.15rem 0.55rem;
}
.album.compact .album-name {
  font-size: 0.9rem;
}
</style>

<style>
.album .ember {
  position: absolute;
  z-index: 5;
  width: 5px;
  height: 5px;
  margin: -2.5px 0 0 -2.5px;
  border-radius: 50%;
  background: #ffb54a;
  box-shadow: 0 0 8px 2px rgba(255, 140, 40, 0.8);
  pointer-events: none;
}
</style>
