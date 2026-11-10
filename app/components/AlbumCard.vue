<script setup lang="ts">
import { animate } from 'animejs'
import { computed, nextTick, ref, watch } from 'vue'
import { PHOTO_WIDTHS, type Album } from '~/data/albums'
import { ui } from '~/composables/useStory'
import { soundscape } from '~/core/audio'

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
const current = computed(() => props.album.photos[index.value]!)
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
  soundscape.flick(dir > 0 ? 1 : -1)
  const photo = props.album.photos[index.value]!
  live.value = `${props.album.name} photo ${index.value + 1} of ${n.value}: ${photo.alt}`
  if (from) embers(from)
  void nextTick(develop)
}

/** The prints are old: a little faded and warm. The develop effect settles on this, not on a crisp photo. */
const AGED = 'sepia(0.22) saturate(0.82) contrast(0.94) brightness(1.03)'

/** The one signature effect: the new photo develops in from a warm haze. */
function develop() {
  const img = root.value?.querySelector<HTMLElement>('.photo.current video') ?? root.value?.querySelector<HTMLElement>('.photo.current img')
  if (!img || !haze.value) return
  if (ui.reduced) {
    animate(haze.value, { opacity: [0.6, 0], duration: 250, ease: 'linear' })
    return
  }
  animate(haze.value, { opacity: [0.85, 0], duration: 420, ease: 'outQuad' })
  animate(img, {
    filter: ['sepia(0.7) saturate(0.35) brightness(1.3) contrast(0.8)', AGED],
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
      <!-- a clip loops silently over its poster while it's the photo showing, like a live photo -->
      <video
        v-if="load !== false && current.video && !ui.reduced"
        :key="`${current.src}.mp4`"
        class="photo current clip"
        :src="`${current.src}.mp4`"
        :poster="`${current.src}-800.webp`"
        :aria-label="current.alt"
        muted
        loop
        autoplay
        playsinline
        disablepictureinpicture
        preload="auto"
        draggable="false"
      />
      <span ref="haze" class="haze" aria-hidden="true" />
      <template v-if="!compact">
        <button type="button" class="arrow prev" :aria-label="`Previous ${name} photo`" @click.stop="go(-1, $event.currentTarget as HTMLElement)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 2.6 18.8 5.6 12.4 12 18.8 18.4 15.8 21.4 6.4 12Z" fill="currentColor" /></svg>
        </button>
        <button type="button" class="arrow next" :aria-label="`Next ${name} photo`" @click.stop="go(1, $event.currentTarget as HTMLElement)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 2.6 5.2 5.6 11.6 12 5.2 18.4 8.2 21.4 17.6 12Z" fill="currentColor" /></svg>
        </button>
      </template>
    </component>
    <div class="album-strip">
      <span class="album-name">{{ album.name }}</span>
      <span v-if="!compact" class="album-count" aria-hidden="true">
        <svg v-if="current.video" class="clip-mark" viewBox="0 0 12 12"><path d="M3 1.8v8.4L10.2 6z" fill="currentColor" /></svg>{{ index + 1 }} / {{ n }}
      </span>
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
  padding: 10px 10px 0;
  /* an old instant print: square corners, aged cream stock with a faint grain, yellowed toward the edges */
  border-radius: 1px;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.27 0 0 0 0 0.16 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.35'/%3E%3C/svg%3E"),
    radial-gradient(ellipse at 50% 45%, rgba(255, 251, 240, 0.55), transparent 72%),
    var(--card);
  color: var(--card-ink);
  box-shadow:
    inset 0 0 14px rgba(150, 105, 45, 0.28),
    inset 0 0 0 1px rgba(120, 90, 50, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 10px 22px rgba(0, 0, 0, 0.4),
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
  border-radius: 0;
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
.photo img,
.photo.clip {
  object-fit: cover;
  display: block;
  filter: sepia(0.22) saturate(0.82) contrast(0.94) brightness(1.03);
}
/* a soft vignette and a hairline where the photo meets the paper */
.album-window::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  background: radial-gradient(ellipse at 50% 48%, transparent 58%, rgba(45, 28, 12, 0.32) 100%);
  box-shadow: inset 0 0 0 1px rgba(40, 25, 10, 0.25), inset 0 0 6px rgba(40, 25, 10, 0.3);
  pointer-events: none;
}
.photo.clip {
  /* above its poster, under the developing haze */
  pointer-events: none;
}
.clip-mark {
  width: 0.6rem;
  height: 0.6rem;
  margin-right: 0.35rem;
  vertical-align: -0.02rem;
  opacity: 0.75;
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
  width: 34px;
  height: 40px;
  margin-top: -20px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 2px;
  /* a scrap of the same paper, with an inked chevron */
  background: rgba(239, 229, 208, 0.88);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  color: #4a3b30;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
}
.arrow svg {
  width: 18px;
  height: 18px;
}
.arrow:hover {
  background: rgba(247, 240, 224, 0.96);
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
/* the label is inked onto the strip by hand */
.album-name {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: 1.15rem;
  color: #3b2c22;
  transform: rotate(-1.2deg);
  transform-origin: left center;
}
.album-count {
  font-style: italic;
  font-size: 0.85rem;
  color: #6a5444;
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
