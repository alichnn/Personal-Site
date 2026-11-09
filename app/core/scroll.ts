import Lenis from 'lenis'
import { scrollFromStory } from './timeline'

let lenis: Lenis | null = null

/** Smooth, inertial scrolling. The render loop drives it, so there's a single rAF. */
export function createScroll(reduced: boolean) {
  lenis?.destroy()
  lenis = new Lenis({
    autoRaf: false,
    smoothWheel: !reduced,
    lerp: 0.09,
    wheelMultiplier: 0.9,
    touchMultiplier: 1,
  })
  lenis.stop()
  return lenis
}

export const getScroll = () => lenis

const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Fly the story to progress `p` (the nav and "back to the start"): the duration grows with the
 * distance, about 1s to a neighbouring chapter and at most 2.6s across the whole story.
 */
export function flyToProgress(p: number, immediate = false) {
  if (!lenis) return
  const target = scrollFromStory(p) * lenis.limit
  const dist = Math.abs(target - lenis.scroll) / Math.max(1, lenis.limit)
  lenis.scrollTo(target, { immediate, duration: Math.min(2.6, 0.8 + dist * 2.2), easing: inOutCubic, force: true })
}

/** Scroll so that story progress equals `p`. */
export function scrollToProgress(p: number, immediate = false) {
  if (!lenis) return
  lenis.scrollTo(scrollFromStory(p) * lenis.limit, { immediate, duration: immediate ? 0 : 1.4, force: true })
}
