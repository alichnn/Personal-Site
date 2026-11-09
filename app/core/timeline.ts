// Every scroll-progress range in the story lives here, so tuning by feel is a one-file job.
// `p` is raw scroll progress (0 → 1). World animation is keyed on `p` directly; only camera
// travel goes through the plateau remap in camera.ts.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a))
export const smooth = (x: number, a: number, b: number) => {
  const t = ramp(x, a, b)
  return t * t * (3 - 2 * t)
}
/** 0 before a, rises to 1 by b, holds, falls back to 0 between c and d. */
export const bell = (x: number, a: number, b: number, c: number, d: number) =>
  Math.min(smooth(x, a, b), 1 - smooth(x, c, d))
/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export type Range4 = [number, number, number, number]

/** Total scroll length, in small-viewport heights. */
export const SCROLL_SVH = 3000

/**
 * The cloud intro (story 0 → INTRO_STORY) takes only the first INTRO_SCROLL of the page, so the
 * fly-through is brisk and later sections get more room. Everything else is keyed on story progress.
 */
const INTRO_STORY = 0.118
const INTRO_SCROLL = 0.07
export function storyFromScroll(s: number) {
  return s <= INTRO_SCROLL ? (s * INTRO_STORY) / INTRO_SCROLL : INTRO_STORY + ((s - INTRO_SCROLL) * (1 - INTRO_STORY)) / (1 - INTRO_SCROLL)
}
export function scrollFromStory(p: number) {
  return p <= INTRO_STORY ? (p * INTRO_SCROLL) / INTRO_STORY : INTRO_SCROLL + ((p - INTRO_STORY) * (1 - INTRO_SCROLL)) / (1 - INTRO_STORY)
}

export const T = {
  intro: [0, 0.012] as [number, number], // scroll hint
  burst: 0.106, // camera breaks through the last cloud wall
  hero: [0.118, 0.13, 0.188, 0.2] as Range4,
  people: [0.204, 0.214, 0.258, 0.27] as Range4,
  dusk: [0.205, 0.3] as [number, number],
  goal: [0.3, 0.312, 0.384, 0.398] as Range4,
  constellation: [0.314, 0.362] as [number, number],
  seeds: [0.392, 0.476] as [number, number],
  sign: [0.49, 0.506, 0.598, 0.614] as Range4,
  bird: [0.618, 0.664] as [number, number],
  work: [0.678, 0.69, 0.79, 0.8] as Range4,
  workRoles: [0.698, 0.778] as [number, number],
  sunset: [0.796, 0.818] as [number, number],
  burn: [0.81, 0.832] as [number, number],
  gather: [0.828, 0.852] as [number, number],
  about: [0.862, 0.874, 0.944, 0.953] as Range4,
  tilt: [0.952, 0.985] as [number, number],
  constellation2: [0.962, 0.988] as [number, number],
  contact: [0.974, 0.988, 2, 3] as Range4,
}

/**
 * The story's chapters, for the nav. `from` is where the chapter begins (for the highlight);
 * `to` is where a jump to it lands: the hero greeting, the Work heading before any role shows,
 * the album cards by the fire, and the finished constellation.
 */
export const SECTIONS = [
  { label: 'Intro', from: 0, to: 0.16 },
  // the heading is fully in by 0.69 and the first role starts fading in just before 0.695
  { label: 'Work', from: T.work[0], to: 0.6925 },
  { label: 'About me', from: T.work[3], to: 0.91 },
  { label: 'Contact', from: T.about[3], to: 1 },
] as const

/** Index of the chapter that progress `p` is in. */
export function sectionAt(p: number) {
  let i = 0
  SECTIONS.forEach((s, k) => p >= s.from && (i = k))
  return i
}

/** The scroll window in which role `i` of `n` is the one in focus. */
export function roleSlot(i: number, n: number): [number, number] {
  const [a, b] = T.workRoles
  const w = (b - a) / n
  return [a + i * w, a + (i + 1) * w]
}

/**
 * Reduced-motion compositions: the camera rests at `rest` while scroll is below `until`,
 * and crossfades to the next composition when that boundary is crossed.
 */
export function compositions(roleCount: number) {
  const list: { until: number; rest: number }[] = [
    { until: 0.11, rest: 0.035 },
    { until: 0.202, rest: 0.16 },
    { until: 0.284, rest: 0.235 },
    { until: 0.4, rest: 0.375 },
    { until: 0.478, rest: 0.474 },
    { until: 0.628, rest: 0.56 },
  ]
  for (let i = 0; i < roleCount; i++) {
    const [a, b] = roleSlot(i, roleCount)
    list.push({ until: i === roleCount - 1 ? 0.8 : b, rest: (a + b) / 2 })
  }
  list.push({ until: 0.855, rest: 0.842 }, { until: 0.955, rest: 0.91 }, { until: 1.01, rest: 1 })
  return list
}
