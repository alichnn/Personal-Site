import Lenis from 'lenis'

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

/** Scroll so that progress equals `p`. */
export function scrollToProgress(p: number, immediate = false) {
  if (!lenis) return
  lenis.scrollTo(p * lenis.limit, { immediate, duration: immediate ? 0 : 1.4, force: true })
}
