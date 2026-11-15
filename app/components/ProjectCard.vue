<script setup lang="ts">
import { animate } from 'animejs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { state } from '~/core/state'
import { flyToProgress, getScroll } from '~/core/scroll'
import { LANTERN_REST } from '~/core/timeline'
import { soundscape } from '~/core/audio'
import { world } from '~/core/world'
import { PROJECT_IMAGE_WIDTHS, TYPES, emphasis, imageSize, projects, type ProjectImage } from '~/data/projects'
import { projectFromHash, projectUi, registerProjectOpener, setProjectHash } from '~/composables/useProjects'
import { ui, useFrame } from '~/composables/useStory'

// The case study: a card that unfolds out of its lantern. The world behind it is blurred and
// dimmed in post-processing (World's blur passes, driven by state.backdrop), and slows almost to
// a stop. On phones the card is a near-full-height sheet: swipe sideways between projects, and
// swipe down to close.

const n = projects.length
const GALLERY_SIZES = '(max-width: 640px) 80vw, 450px'
const LIGHTBOX_SIZES = '(max-width: 640px) 300vw, 100vw'

const root = ref<HTMLElement | null>(null)
const drag = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const light = ref<HTMLElement | null>(null)
const bloom = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
const lightboxEl = ref<HTMLElement | null>(null)
const lightboxClose = ref<HTMLButtonElement | null>(null)
const lightbox = ref(-1)
const sheet = ref(false)
/** No hover (phones, tablets): the hints say "tap" instead of "click". */
const touchUi = ref(false)
const announce = ref('')
let opener: HTMLElement | null = null
let busy = false

const project = computed(() => projects[Math.max(0, projectUi.index)]!)
const type = computed(() => TYPES[project.value.type])
const neighbour = (d: number) => projects[(Math.max(0, projectUi.index) + d + n) % n]!
const metaItems = computed(() => {
  const m = project.value.meta
  const all: [string, string | undefined][] = [['Role', m.role], ['Team', m.team], ['Timeframe', m.timeframe], ['Tools', m.tools?.join(', ')]]
  return all.filter((e): e is [string, string] => !!e[1])
})
/** The neighbouring cards' cover images, loaded (hidden) while this one is open. */
const neighbourCovers = computed(() => {
  if (projectUi.index < 0 || n < 2) return []
  const covers = [neighbour(1).images[0], neighbour(-1).images[0]].filter((c): c is ProjectImage => !!c)
  return covers.filter((c, i) => covers.findIndex((o) => o.src === c.src) === i)
})
const cardVars = computed(() => ({ '--accent': type.value.accent, '--wash': type.value.wash, '--glow': type.value.glow }))

/** Each variant at its real width: images smaller than a size are never enlarged to fill it. */
function srcset(src: string, fmt: string) {
  const [full] = imageSize(src)
  const byWidth = new Map(PROJECT_IMAGE_WIDTHS.map((w) => [Math.min(w, full), `${src}-${w}.${fmt}`]))
  return [...byWidth].map(([w, url]) => `${url} ${w}w`).join(', ')
}
const dims = (src: string) => imageSize(src)

/** Where the lantern is on screen (or the middle of the pond, if it isn't showing). */
function lanternPoint(i: number) {
  const sc = world?.lanterns.screen[i]
  return sc && sc.on ? { x: sc.x, y: sc.y } : { x: innerWidth / 2, y: innerHeight * 0.62 }
}

async function open(i: number, from: HTMLElement | null) {
  if (busy || projectUi.index >= 0 || !projects[i]) return
  busy = true
  opener = from
  projectUi.index = i
  ui.projectOpen = true
  state.lanternUi.open = i
  state.lanternUi.hover = -1
  state.lanternUi.flareAt = state.time
  state.backdrop = 1
  getScroll()?.stop()
  setProjectHash(projects[i]!.slug)
  soundscape.paper(true)
  announce.value = ''
  await nextTick()
  closeBtn.value?.focus({ preventScroll: true })
  await unfold(lanternPoint(i), true)
  busy = false
}

async function close() {
  if (busy || projectUi.index < 0) return
  busy = true
  const i = projectUi.index
  lightbox.value = -1
  state.backdrop = 0
  soundscape.paper(false)
  await unfold(lanternPoint(i), false)
  projectUi.index = -1
  ui.projectOpen = false
  state.lanternUi.open = -1
  getScroll()?.start()
  setProjectHash(null)
  // back to the lantern that opened it (or this project's lantern, after a deep link)
  const back = opener ?? document.querySelectorAll<HTMLElement>('.lantern-btn')[i] ?? null
  opener = null
  back?.focus({ preventScroll: true })
  busy = false
}

/** Move to another project in lantern order (wrapping), or straight to project `to`. */
function step(dir: number, to?: number) {
  if (projectUi.index < 0 || busy) return
  const i = to ?? (projectUi.index + dir + n) % n
  if (i === projectUi.index) return
  projectUi.index = i
  state.lanternUi.open = i
  state.lanternUi.flareAt = state.time
  lightbox.value = -1
  setProjectHash(projects[i]!.slug)
  soundscape.flick(dir < 0 ? -1 : 1)
  scroller.value?.scrollTo({ top: 0 })
  const p = projects[i]!
  announce.value = `Project ${i + 1} of ${n}: ${p.title}, ${TYPES[p.type].label}`
}

/**
 * Opening: the lantern flares, a warm bloom spreads from it, and the card grows out of the
 * lantern's spot like its paper unfolding. Closing runs it back into the lantern.
 */
function unfold(from: { x: number; y: number }, opening: boolean) {
  const el = card.value, glow = light.value, b = bloom.value
  if (!el) return Promise.resolve()
  if (ui.reduced) return animate(el, { opacity: opening ? [0, 1] : [1, 0], duration: 160, ease: 'linear' }).then(() => {})
  const r = el.getBoundingClientRect()
  const dx = from.x - (r.left + r.width / 2), dy = from.y - (r.top + r.height / 2)
  const folded = { x: dx, y: dy, s: 0.04, clip: 'inset(40% 40% 40% 40% round 400px)' }
  const flat = { x: 0, y: 0, s: 1, clip: 'inset(0% 0% 0% 0% round 0px)' }
  const [a, z] = opening ? [folded, flat] : [flat, folded]
  if (b) {
    b.style.left = `${from.x}px`
    b.style.top = `${from.y}px`
    animate(b, opening ? { scale: [0.2, 9], opacity: [0.9, 0], duration: 900, ease: 'outQuad' } : { scale: [5, 0.3], opacity: [0, 0.7, 0], duration: 480, ease: 'inQuad' })
  }
  if (glow) animate(glow, { opacity: opening ? [0.9, 0] : [0, 0.85], duration: opening ? 750 : 380, delay: opening ? 140 : 0, ease: opening ? 'outQuad' : 'inQuad' })
  return animate(el, {
    translateX: [a.x, z.x],
    translateY: [a.y, z.y],
    scale: [a.s, z.s],
    clipPath: [a.clip, z.clip],
    opacity: opening ? { from: 0, to: 1, duration: 180 } : { from: 1, to: 0, duration: 160, delay: 260 },
    duration: opening ? 560 : 420,
    ease: opening ? 'outQuart' : 'inQuart',
  }).then(() => {})
}

// ---------------------------------------------------------------- keys, focus and gestures

function focusables() {
  const scope = lightbox.value >= 0 ? lightboxEl.value : card.value
  return scope ? [...scope.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]')].filter((e) => !e.hasAttribute('disabled')) : []
}

function onKey(e: KeyboardEvent) {
  if (projectUi.index < 0) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (lightbox.value >= 0) closeLightbox()
    else void close()
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const d = e.key === 'ArrowRight' ? 1 : -1
    e.preventDefault()
    if (lightbox.value >= 0) shiftLightbox(d)
    else step(d)
  } else if (e.key === 'Tab') {
    const f = focusables()
    if (!f.length) return
    const first = f[0]!, last = f[f.length - 1]!
    const inside = (lightbox.value >= 0 ? lightboxEl.value : card.value)?.contains(document.activeElement)
    if (!inside) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

// swipe sideways between projects (touch only; the gallery strip keeps its own sideways scroll)
let sx = 0, sy = 0, swiping = false
function swipeStart(e: PointerEvent) {
  swiping = e.pointerType !== 'mouse' && !(e.target as HTMLElement).closest('.pc-gallery')
  sx = e.clientX
  sy = e.clientY
}
function swipeEnd(e: PointerEvent) {
  if (!swiping) return
  swiping = false
  const dx = e.clientX - sx, dy = e.clientY - sy
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
}

// phones: drag the sheet down to close it (from its top bar, or from the content when it's scrolled to the top)
let ty = 0, tx = 0, pulling = false, armed = false, pull = 0
function touchStart(e: TouchEvent) {
  if (!sheet.value || lightbox.value >= 0) return
  const t = e.touches[0]!
  tx = t.clientX
  ty = t.clientY
  const inBar = !!(e.target as HTMLElement).closest('.pc-bar')
  armed = inBar || (scroller.value?.scrollTop ?? 0) <= 0
  pulling = false
  pull = 0
}
function touchMove(e: TouchEvent) {
  if (!armed) return
  const t = e.touches[0]!
  const dy = t.clientY - ty, dx = t.clientX - tx
  if (!pulling && dy > 8 && dy > Math.abs(dx)) pulling = true
  if (!pulling) return
  e.preventDefault()
  pull = Math.max(0, dy)
  if (drag.value) drag.value.style.transform = `translateY(${pull}px)`
}
function touchEnd() {
  if (!pulling) return
  pulling = armed = false
  const el = drag.value
  if (!el) return
  if (pull > 110) {
    el.style.transform = ''
    void close()
  } else animate(el, { translateY: [pull, 0], duration: 260, ease: 'outQuad' })
}

// ---------------------------------------------------------------- gallery lightbox

let lightboxOpener: HTMLElement | null = null
async function openLightbox(j: number, e: Event) {
  lightboxOpener = e.currentTarget as HTMLElement
  lightbox.value = j
  await nextTick()
  lightboxClose.value?.focus({ preventScroll: true })
}
function closeLightbox() {
  lightbox.value = -1
  lightboxOpener?.focus({ preventScroll: true })
}
function shiftLightbox(d: number) {
  const m = project.value.images.length
  if (m > 1) lightbox.value = (lightbox.value + d + m) % m
}
// Zoom, so text-dense slides stay readable on a phone: pinch (or ctrl/trackpad-pinch on a computer),
// drag to pan once zoomed, double-tap or double-click to zoom in and out. When not zoomed, a sideways
// swipe changes image and a tap outside the image closes the enlarged view.
const zoomImg = ref<HTMLElement | null>(null)
const zoom = { s: 1, x: 0, y: 0 }
const MAX_ZOOM = 4
const pointers = new Map<number, { x: number; y: number }>()
let pinch: { d: number; s: number } | null = null
let pan: { x: number; y: number; ox: number; oy: number; moved: boolean } | null = null
let lastTap = 0
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

function applyZoom(ease = false) {
  const el = zoomImg.value
  if (!el) return
  const mx = (el.offsetWidth * (zoom.s - 1)) / 2, my = (el.offsetHeight * (zoom.s - 1)) / 2
  zoom.x = clampN(zoom.x, -mx, mx)
  zoom.y = clampN(zoom.y, -my, my)
  el.style.transition = ease && !ui.reduced ? 'transform 0.25s ease' : 'none'
  el.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`
}
/** Zoom to `s`, keeping the point under (cx, cy) where it is. */
function zoomAt(s: number, cx: number, cy: number) {
  const r = zoomImg.value?.parentElement?.getBoundingClientRect()
  if (!r) return
  const ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2)
  const k = s / zoom.s
  zoom.x = ox - (ox - zoom.x) * k
  zoom.y = oy - (oy - zoom.y) * k
  zoom.s = s
}
function resetZoom(ease = false) {
  zoom.s = 1
  zoom.x = zoom.y = 0
  applyZoom(ease)
}
function zDown(e: PointerEvent) {
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // the pointer is already gone; carry on without capture
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    pinch = { d: Math.max(1, gap(a, b)), s: zoom.s }
    pan = null
  } else if (pointers.size === 1) pan = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y, moved: false }
}
function zMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    zoomAt(clampN((pinch.s * gap(a, b)) / pinch.d, 1, MAX_ZOOM), (a.x + b.x) / 2, (a.y + b.y) / 2)
    applyZoom()
  } else if (pan) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y
    if (Math.hypot(dx, dy) > 6) pan.moved = true
    if (zoom.s > 1) {
      zoom.x = pan.ox + dx
      zoom.y = pan.oy + dy
      applyZoom()
    }
  }
}
function zUp(e: PointerEvent) {
  if (!pointers.delete(e.pointerId)) return
  if (pinch) {
    // lifting one finger of a pinch: carry on panning with the other
    pinch = null
    const rest = [...pointers.values()][0]
    pan = rest ? { x: rest.x, y: rest.y, ox: zoom.x, oy: zoom.y, moved: true } : null
  } else if (pan && pointers.size === 0) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y
    if (zoom.s <= 1.01 && e.type === 'pointerup') {
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) shiftLightbox(dx < 0 ? 1 : -1)
      else if (!pan.moved) tap(e)
    } else if (!pan.moved && e.type === 'pointerup') tap(e)
    pan = null
  }
  if (pointers.size === 0 && zoom.s < 1.03) resetZoom(true)
}
function tap(e: PointerEvent) {
  const r = zoomImg.value?.getBoundingClientRect()
  const onImage = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  if (!onImage && zoom.s <= 1.01) return closeLightbox()
  const now = performance.now()
  if (now - lastTap < 320) {
    lastTap = 0
    if (zoom.s > 1.01) resetZoom(true)
    else {
      zoomAt(2.5, e.clientX, e.clientY)
      applyZoom(true)
    }
  } else lastTap = now
}
function zWheel(e: WheelEvent) {
  // a trackpad pinch arrives as ctrl + wheel
  if (!e.ctrlKey) return
  e.preventDefault()
  zoomAt(clampN(zoom.s * Math.exp(-e.deltaY * 0.01), 1, MAX_ZOOM), e.clientX, e.clientY)
  applyZoom()
}
watch(lightbox, () => {
  pointers.clear()
  pinch = pan = null
  void nextTick(() => resetZoom())
})

// ---------------------------------------------------------------- deep links

/** Open a project as soon as its lantern is lit and settled on screen. */
useFrame(() => {
  const i = projectUi.pending
  if (i < 0 || busy) return
  if (projectUi.index >= 0) {
    projectUi.pending = -1
    step(i > projectUi.index ? 1 : -1, i)
    return
  }
  if (world?.lanterns.screen[i]?.on) {
    projectUi.pending = -1
    void open(i, null)
  }
})

function onHash() {
  const i = projectFromHash()
  if (i < 0) {
    if (projectUi.index >= 0) void close()
    return
  }
  if (i === projectUi.index) return
  projectUi.pending = i
  if (projectUi.index < 0) flyToProgress(LANTERN_REST, ui.reduced)
}

let mq: MediaQueryList | null = null
const onMq = () => (sheet.value = !!mq?.matches)
onMounted(() => {
  registerProjectOpener((i, from) => void open(i, from))
  addEventListener('hashchange', onHash)
  // on the window, so Esc and the arrows work even if focus has wandered off the card
  addEventListener('keydown', onKey)
  mq = matchMedia('(max-width: 640px)')
  onMq()
  touchUi.value = matchMedia('(hover: none)').matches
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => {
  registerProjectOpener(null)
  removeEventListener('hashchange', onHash)
  removeEventListener('keydown', onKey)
  mq?.removeEventListener('change', onMq)
})
</script>

<template>
  <div v-if="projectUi.index >= 0" ref="root" class="pc" :class="{ sheet }" :style="cardVars">
    <div class="pc-backdrop" aria-hidden="true" @click="close" />
    <span ref="bloom" class="pc-bloom" aria-hidden="true" />
    <div ref="drag" class="pc-drag" @touchstart="touchStart" @touchmove="touchMove" @touchend="touchEnd" @touchcancel="touchEnd">
      <section ref="card" class="pc-card" role="dialog" aria-modal="true" aria-labelledby="pc-title">
        <span ref="light" class="pc-light" aria-hidden="true" />
        <header class="pc-bar">
          <span v-if="sheet" class="pc-grip" aria-hidden="true" />
          <div class="pc-nav">
            <button type="button" class="pc-icon" :aria-label="`Previous project: ${neighbour(-1).title}`" @click="step(-1)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 2.6 18.8 5.6 12.4 12 18.8 18.4 15.8 21.4 6.4 12Z" fill="currentColor" /></svg>
            </button>
            <span class="pc-count" aria-hidden="true">{{ projectUi.index + 1 }} / {{ n }}</span>
            <button type="button" class="pc-icon" :aria-label="`Next project: ${neighbour(1).title}`" @click="step(1)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 2.6 5.2 5.6 11.6 12 5.2 18.4 8.2 21.4 17.6 12Z" fill="currentColor" /></svg>
            </button>
          </div>
          <button ref="closeBtn" type="button" class="pc-icon pc-close" aria-label="Close project" @click="close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
          </button>
        </header>

        <div ref="scroller" class="pc-scroll" data-lenis-prevent @pointerdown="swipeStart" @pointerup="swipeEnd" @pointercancel="swiping = false">
          <Transition name="pc-swap" mode="out-in">
            <article :key="project.slug" class="pc-body">
              <p class="pc-type"><span class="pc-dot" aria-hidden="true" />{{ type.label }}<template v-if="project.typeDetail"> · {{ project.typeDetail }}</template></p>
              <h2 id="pc-title" class="pc-title">{{ project.title }}</h2>
              <p class="pc-summary">{{ project.summary }}</p>

              <dl v-if="metaItems.length" class="pc-meta">
                <div v-for="[k, v] in metaItems" :key="k">
                  <dt>{{ k }}</dt>
                  <dd>{{ v }}</dd>
                </div>
              </dl>

              <section v-if="project.context" class="pc-section">
                <h3>Context</h3>
                <p>{{ project.context }}</p>
              </section>

              <section v-if="project.contributions.length" class="pc-section">
                <h3>What I did</h3>
                <ul class="pc-did">
                  <li v-for="c in project.contributions" :key="c">
                    <template v-for="(run, k) in emphasis(c)" :key="k">
                      <strong v-if="run.bold">{{ run.text }}</strong><em v-else-if="run.italic">{{ run.text }}</em><template v-else>{{ run.text }}</template>
                    </template>
                  </li>
                </ul>
              </section>

              <section v-if="project.results.length" class="pc-section">
                <h3>
                  Results
                  <!-- modelled numbers are always labelled as such, never shown as achieved -->
                  <span v-if="project.resultsProjected" class="pc-projected"><span class="sr-only">, </span>Projected</span>
                </h3>
                <ul class="pc-results">
                  <li v-for="r in project.results" :key="r.value + r.label">
                    <span class="pc-result-value">{{ r.value }}</span>
                    <span class="pc-result-label">{{ r.label }}</span>
                  </li>
                </ul>
                <p v-if="project.resultsNote" class="pc-results-note">{{ project.resultsNote }}</p>
              </section>

              <section v-if="project.team" class="pc-section">
                <h3>Team</h3>
                <p>{{ project.team }}</p>
              </section>

              <section v-if="project.images.length" class="pc-section">
                <h3>Gallery</h3>
                <div class="pc-gallery">
                  <button
                    v-for="(img, j) in project.images"
                    :key="img.src"
                    type="button"
                    class="pc-shot"
                    :aria-label="`${img.video ? 'Play video' : 'Enlarge image'} ${j + 1} of ${project.images.length}: ${img.alt}`"
                    @click="openLightbox(j, $event)"
                  >
                    <picture>
                      <source type="image/avif" :srcset="srcset(img.src, 'avif')" :sizes="GALLERY_SIZES">
                      <source type="image/webp" :srcset="srcset(img.src, 'webp')" :sizes="GALLERY_SIZES">
                      <img :src="`${img.src}-640.webp`" :alt="img.alt" :width="dims(img.src)[0]" :height="dims(img.src)[1]" loading="lazy" decoding="async" draggable="false">
                    </picture>
                    <span v-if="img.video" class="pc-play" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
                    </span>
                    <span class="pc-enlarge" aria-hidden="true">
                      <svg v-if="!img.video" viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                      <!-- tall images are too narrow for the words: just the icon there -->
                      <template v-if="dims(img.src)[0] / dims(img.src)[1] >= 0.9">{{ touchUi ? 'Tap' : 'Click' }} to {{ img.video ? 'play' : 'enlarge' }}</template>
                    </span>
                  </button>
                </div>
              </section>

              <section v-if="project.links.length" class="pc-section">
                <h3 class="sr-only">Links</h3>
                <div class="pc-links">
                  <a v-for="l in project.links" :key="l.href" class="pc-link" :href="l.href" target="_blank" rel="noopener noreferrer">
                    {{ l.label }}<span class="sr-only"> (opens in a new tab)</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </a>
                </div>
              </section>
            </article>
          </Transition>
        </div>
        <p class="sr-only" aria-live="polite">{{ announce }}</p>

      </section>
    </div>
    <!-- outside the card: the card keeps a transform from unfolding, which would trap a fixed overlay -->
    <div v-if="lightbox >= 0 && project.images[lightbox]" ref="lightboxEl" class="pc-lightbox" role="dialog" aria-modal="true" :aria-label="`Image ${lightbox + 1} of ${project.images.length}`">
      <button ref="lightboxClose" type="button" class="pc-icon pc-lb-close" aria-label="Close image" @click="closeLightbox">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
      </button>
      <!-- a clip plays with its own controls (and sound); stills can be zoomed -->
      <div v-if="project.images[lightbox]!.video" class="pc-lb-stage pc-lb-video" @click.self="closeLightbox">
        <video
          :key="project.images[lightbox]!.src"
          :src="`${project.images[lightbox]!.src}.mp4`"
          :poster="`${project.images[lightbox]!.src}-1280.webp`"
          :aria-label="project.images[lightbox]!.alt"
          :style="{ '--ar': dims(project.images[lightbox]!.src)[0] / dims(project.images[lightbox]!.src)[1] }"
          controls
          autoplay
          playsinline
          preload="metadata"
        />
      </div>
      <div v-else class="pc-lb-stage" @pointerdown="zDown" @pointermove="zMove" @pointerup="zUp" @pointercancel="zUp" @wheel="zWheel">
        <picture>
          <!-- phones fetch the full-size slide up front, so text stays sharp when pinched in -->
          <source type="image/avif" :srcset="srcset(project.images[lightbox]!.src, 'avif')" :sizes="LIGHTBOX_SIZES">
          <source type="image/webp" :srcset="srcset(project.images[lightbox]!.src, 'webp')" :sizes="LIGHTBOX_SIZES">
          <img
            ref="zoomImg"
            :src="`${project.images[lightbox]!.src}-1280.webp`"
            :alt="project.images[lightbox]!.alt"
            :width="dims(project.images[lightbox]!.src)[0]"
            :height="dims(project.images[lightbox]!.src)[1]"
            :style="{ '--ar': dims(project.images[lightbox]!.src)[0] / dims(project.images[lightbox]!.src)[1] }"
            decoding="async"
            draggable="false"
          >
        </picture>
      </div>
      <p v-if="!project.images[lightbox]!.video" class="pc-lb-hint" aria-hidden="true">{{ touchUi ? 'Pinch or double-tap to zoom' : 'Double-click to zoom' }}</p>
      <template v-if="project.images.length > 1">
        <button type="button" class="pc-icon pc-lb-prev" aria-label="Previous image" @click="shiftLightbox(-1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 2.6 18.8 5.6 12.4 12 18.8 18.4 15.8 21.4 6.4 12Z" fill="currentColor" /></svg>
        </button>
        <button type="button" class="pc-icon pc-lb-next" aria-label="Next image" @click="shiftLightbox(1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 2.6 5.2 5.6 11.6 12 5.2 18.4 8.2 21.4 17.6 12Z" fill="currentColor" /></svg>
        </button>
      </template>
    </div>
    <!-- the neighbouring projects' covers, fetched now so moving between cards is instant -->
    <div class="pc-preload" aria-hidden="true">
      <picture v-for="c in neighbourCovers" :key="c.src">
        <source type="image/avif" :srcset="srcset(c.src, 'avif')" :sizes="GALLERY_SIZES">
        <source type="image/webp" :srcset="srcset(c.src, 'webp')" :sizes="GALLERY_SIZES">
        <img :src="`${c.src}-640.webp`" alt="" width="1" height="1" loading="eager">
      </picture>
    </div>
  </div>
</template>

<style scoped>
.pc {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  color: var(--card-ink);
}
/* the dimming and blur happen in the world itself; this only catches clicks */
.pc-backdrop {
  position: absolute;
  inset: 0;
}
.pc-bloom {
  position: fixed;
  left: 50%;
  top: 50%;
  width: 180px;
  height: 180px;
  margin: -90px 0 0 -90px;
  border-radius: 50%;
  background: radial-gradient(closest-side, #fff4dc, var(--glow) 40%, transparent);
  opacity: 0;
  pointer-events: none;
  mix-blend-mode: screen;
}
.pc-drag {
  position: relative;
  width: min(760px, 100%);
  max-height: min(88vh, 900px);
  display: flex;
}
.pc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: inherit;
  overflow: hidden;
  border-radius: 2px;
  /* the lantern's paper, unfolded: aged cream stock with a faint grain, a thin stripe of its colour on top */
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.27 0 0 0 0 0.16 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.3'/%3E%3C/svg%3E"),
    radial-gradient(ellipse at 50% 30%, rgba(255, 251, 240, 0.6), transparent 70%),
    var(--card);
  border-top: 4px solid var(--accent);
  box-shadow:
    inset 0 0 18px rgba(150, 105, 45, 0.22),
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 24px 60px rgba(0, 0, 0, 0.5),
    0 0 80px color-mix(in srgb, var(--glow) 28%, transparent);
  transition: border-color 0.45s ease, box-shadow 0.45s ease;
  transform-origin: 50% 50%;
}
.pc-card:focus {
  outline: none;
}
.pc-light {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: radial-gradient(ellipse at 50% 55%, #fff6e0, color-mix(in srgb, var(--glow) 70%, #fff3dc) 55%, var(--glow));
  opacity: 0;
  pointer-events: none;
}
.pc-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 0.8rem 0.4rem 1.2rem;
  flex: none;
}
.pc-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.pc-count {
  min-width: 3.2em;
  text-align: center;
  font-style: italic;
  font-size: 0.9rem;
  color: #6a5444;
  font-variant-numeric: tabular-nums;
}
.pc-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: rgba(239, 229, 208, 0.9);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  color: #4a3b30;
  cursor: pointer;
  transition: background 0.2s ease, color 0.3s ease;
}
.pc-icon:hover {
  background: #f7f0e0;
  color: var(--accent);
}
.pc-icon svg {
  width: 18px;
  height: 18px;
}
.pc-scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 0.4rem clamp(1.2rem, 4vw, 2.6rem) 2.2rem;
}
.pc-body {
  display: grid;
  gap: 0.2rem;
}
.pc-type {
  margin: 0.2rem 0 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  transition: color 0.45s ease;
}
.pc-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  background: var(--glow);
  box-shadow: 0 0 0 2px var(--accent);
  transition: background-color 0.45s ease, box-shadow 0.45s ease;
}
.pc-title {
  margin: 0.15rem 0 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.7rem, 4vw, 2.4rem);
  line-height: 1.1;
  color: #2a1d14;
  text-wrap: balance;
}
.pc-summary {
  margin: 0.45rem 0 0;
  font-style: italic;
  font-size: clamp(1.08rem, 1.8vw, 1.22rem);
  line-height: 1.4;
  color: #4a3a2e;
}
.pc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.8rem;
  margin: 1.1rem 0 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid rgba(90, 64, 40, 0.22);
}
.pc-meta dt {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6a5444;
}
.pc-meta dd {
  margin: 0.1rem 0 0;
  font-size: 1rem;
}
.pc-section {
  margin-top: 1.4rem;
}
.pc-section h3 {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  transition: color 0.45s ease;
}
.pc-section p {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.55;
}
.pc-did {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pc-did strong {
  font-weight: 700;
  color: #2a1d14;
}
.pc-did li {
  position: relative;
  padding-left: 1.4rem;
  font-size: 1.05rem;
  line-height: 1.5;
}
/* the same small diamond the chapter legend uses */
.pc-did li::before {
  content: '';
  position: absolute;
  left: 0.2rem;
  top: 0.62em;
  width: 6px;
  height: 6px;
  background: var(--accent);
  transform: rotate(45deg);
  transition: background-color 0.45s ease;
}
.pc-projected {
  display: inline-block;
  margin-left: 0.6rem;
  padding: 0.08rem 0.5rem 0.1rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  vertical-align: 0.1em;
  transition: border-color 0.45s ease;
}
.pc-results-note {
  margin: 0.7rem 0 0 !important;
  font-size: 0.88rem !important;
  line-height: 1.45 !important;
  color: #5c4838;
}
.pc-results {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pc-results li {
  display: grid;
  gap: 0.15rem;
  min-width: 10rem;
  flex: 1 1 10rem;
  max-width: 18rem;
  padding: 0.8rem 1rem 0.9rem;
  background: var(--wash);
  border-left: 3px solid var(--accent);
  transition: background-color 0.45s ease, border-color 0.45s ease;
}
.pc-result-value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.9rem, 4.4vw, 2.6rem);
  line-height: 1;
  color: var(--accent);
  transition: color 0.45s ease;
}
.pc-result-label {
  font-size: 0.95rem;
  line-height: 1.35;
  color: #4a3a2e;
}
.pc-gallery {
  display: flex;
  gap: 0.8rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  padding: 0.2rem 0.1rem 0.7rem;
  margin: 0 -0.1rem;
}
.pc-gallery {
  align-items: flex-start;
}
/* every image in the strip is the same height and keeps its own shape */
.pc-shot {
  flex: 0 0 auto;
  position: relative;
  height: clamp(110px, 19vh, 170px);
  max-width: 88%;
  padding: 0;
  border: 0;
  background: #e3d7bf;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 6px 14px rgba(0, 0, 0, 0.18);
  scroll-snap-align: start;
  cursor: zoom-in;
}
.pc-shot img {
  display: block;
  width: auto;
  height: 100%;
  max-width: 100%;
  /* screenshots and diagrams never lose their edges */
  object-fit: contain;
}
/* a clip's thumbnail carries a play button */
.pc-play {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin: -23px 0 0 -23px;
  border-radius: 50%;
  background: rgba(42, 29, 20, 0.72);
  color: #fff7ea;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.pc-play svg {
  width: 22px;
  height: 22px;
  margin-left: 3px;
}
.pc-shot:hover .pc-play,
.pc-shot:focus-visible .pc-play {
  transform: scale(1.08);
  background: var(--accent);
}
/* a quiet "enlarge" tag on each thumbnail */
.pc-enlarge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.12rem 0.45rem 0.14rem;
  border-radius: 2px;
  background: rgba(239, 229, 208, 0.92);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  color: #4a3b30;
  font-size: 0.72rem;
  line-height: 1.2;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}
.pc-enlarge {
  white-space: nowrap;
}
.pc-enlarge svg {
  width: 11px;
  height: 11px;
}
.pc-shot:hover .pc-enlarge,
.pc-shot:focus-visible .pc-enlarge {
  opacity: 1;
}
.pc-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}
.pc-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border: 1.5px solid var(--accent);
  border-radius: 2px;
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.45s ease, border-color 0.45s ease;
}
.pc-link:hover {
  background: var(--wash);
}
.pc-link svg {
  width: 16px;
  height: 16px;
}
.pc-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(12, 8, 6, 0.9);
}
/* the gesture surface: the browser's own pinch and scroll are off here, the lightbox does its own */
.pc-lb-stage {
  position: absolute;
  inset: 56px 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.pc-lb-stage img {
  display: block;
  width: min(94vw, calc((100svh - 150px) * var(--ar, 1.6)));
  height: auto;
  transform-origin: 50% 50%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  -webkit-user-drag: none;
}
.pc-lb-video {
  touch-action: auto;
}
.pc-lb-video video {
  display: block;
  width: min(94vw, calc((100svh - 150px) * var(--ar, 1.78)));
  height: auto;
  background: #000;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.pc-lb-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(14px, env(safe-area-inset-bottom));
  margin: 0;
  text-align: center;
  font-style: italic;
  font-size: 0.85rem;
  color: rgba(246, 238, 221, 0.7);
  pointer-events: none;
}
@media (max-width: 640px) {
  /* phones: slides at the full width of the screen */
  .pc-lb-stage img {
    width: 100vw;
    max-height: calc(100svh - 150px);
    object-fit: contain;
  }
}
.pc-lb-close {
  z-index: 1;
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  right: 12px;
}
.pc-lb-prev,
.pc-lb-next {
  z-index: 1;
  position: absolute;
  top: 50%;
  margin-top: -20px;
}
.pc-lb-prev {
  left: 12px;
}
.pc-lb-next {
  right: 12px;
}
.pc-preload {
  display: none;
}

/* moving between projects: the content cross-fades */
.pc-swap-enter-active,
.pc-swap-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.pc-swap-enter-from,
.pc-swap-leave-to {
  opacity: 0;
}

/* phones: a near-full-height sheet */
.pc.sheet {
  place-items: end center;
  padding: 0;
}
.pc.sheet .pc-drag {
  width: 100%;
  max-height: none;
  height: calc(100svh - max(36px, env(safe-area-inset-top)));
}
.pc.sheet .pc-card {
  border-radius: 14px 14px 0 0;
}
.pc.sheet .pc-bar {
  padding-top: 1.1rem;
  touch-action: none;
}
.pc-grip {
  position: absolute;
  top: 0.45rem;
  left: 50%;
  width: 44px;
  height: 4px;
  margin-left: -22px;
  border-radius: 2px;
  background: rgba(90, 64, 40, 0.35);
}
.pc.sheet .pc-scroll {
  padding-bottom: max(2.2rem, env(safe-area-inset-bottom));
}

@media (prefers-reduced-motion: reduce) {
  .pc-swap-enter-active,
  .pc-swap-leave-active {
    transition: none;
  }
}
</style>
