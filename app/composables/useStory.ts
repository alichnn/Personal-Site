import { onBeforeUnmount, onMounted, reactive, type Ref } from 'vue'
import { createTimeline, type Timeline } from 'animejs'
import { frameHooks, state, type Tier } from '~/core/state'
import { scrollToProgress } from '~/core/scroll'
import type { Range4 } from '~/core/timeline'

/** UI state that Vue templates react to (low-frequency, unlike core/state). */
export const ui = reactive({
  loadProgress: 0,
  ready: false,
  tier: 'high' as Tier,
  reduced: false,
  sound: false,
  /** Set once the visitor nears the campfire, so album images load lazily. */
  albumsNear: false,
  /** An album is open full-screen (the nav steps aside). */
  albumOpen: false,
})

export function useFrame(cb: () => void) {
  onMounted(() => frameHooks.add(cb))
  onBeforeUnmount(() => frameHooks.delete(cb))
}

/** Map progress onto a 0..1000 timeline: 0-300 in, 300-700 hold, 700-1000 out. */
export function blockTime(p: number, [a, b, c, d]: Range4) {
  if (p <= a) return 0
  if (p < b) return (300 * (p - a)) / (b - a)
  if (p <= c) return 300 + (400 * (p - b)) / (c - b)
  if (p < d) return 700 + (300 * (p - c)) / (d - c)
  return 1000
}

/**
 * Scrubs a block in and out with scroll: fades and un-blurs at the start of its range, holds,
 * and fades out at the end. Animated by anime.js, driven by progress rather than time.
 */
export function useScrubbedBlock(el: Ref<HTMLElement | null>, range: Range4, opts: { onTime?: (t: number) => void } = {}) {
  let tl: Timeline | null = null
  let last = -1
  onMounted(() => {
    const target = el.value
    if (!target) return
    tl = createTimeline({ autoplay: false, defaults: { ease: 'linear' } })
    if (ui.reduced) {
      tl.add(target, { opacity: [0, 1], duration: 300 }, 0).add(target, { opacity: [1, 0], duration: 300 }, 700)
    } else {
      tl.add(target, { opacity: [0, 1], filter: ['blur(12px)', 'blur(0px)'], translateY: [18, 0], duration: 300, ease: 'outQuad' }, 0)
        .add(target, { opacity: [1, 0], filter: ['blur(0px)', 'blur(10px)'], translateY: [0, -16], duration: 300, ease: 'inQuad' }, 700)
    }
    tl.seek(0)
  })
  useFrame(() => {
    const target = el.value
    if (!tl || !target) return
    const t = blockTime(state.p, range)
    if (t === last) return
    last = t
    tl.seek(t)
    // stays focusable while invisible: tabbing to it scrolls the story there (see focusScroll)
    target.classList.toggle('is-live', t > 120 && t < 880)
    opts.onTime?.(t)
  })
  onBeforeUnmount(() => tl?.revert())
}

/** Keyboard users: focusing something inside a block scrolls the story to that block. */
export function focusScroll(range: Range4) {
  return (e: FocusEvent) => {
    const p = state.p
    const [, b, c] = range
    if (p >= b && p <= c) return
    const target = Math.min(1, (b + Math.min(c, 1)) / 2)
    scrollToProgress(target, ui.reduced)
    // keep focus where the visitor put it
    ;(e.target as HTMLElement | null)?.focus?.({ preventScroll: true })
  }
}
