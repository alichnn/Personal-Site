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

/**
 * Scroll lengths: each knot is [story progress, small-viewport heights scrolled to reach it].
 * Between knots, progress moves evenly with scroll, so each stretch has its own pace and its own
 * budget. Everything else is keyed on story progress, so these only change how far you scroll.
 */
const KNOTS: [number, number][] = [
  [0, 0],
  // the cloud intro, up to "Hey, I'm Alice"
  [0.118, 210],
  // the story through Work
  [0.8, 1289],
  // down to the pond surface while the lanterns float in and light
  [0.842, 1384],
  // the lantern plateau: longer than any text hold, because people stop to explore
  [0.884, 1534],
  // the lanterns rise, the pond burns into the campfire, About, Contact
  [1, 1901],
]
/** Total scroll length, in small-viewport heights. */
export const SCROLL_SVH = KNOTS[KNOTS.length - 1]![1]

function interp(x: number, from: 0 | 1, to: 0 | 1) {
  let i = 0
  while (i < KNOTS.length - 2 && x > KNOTS[i + 1]![from]) i++
  const a = KNOTS[i]!, b = KNOTS[i + 1]!
  return a[to] + ((x - a[from]) * (b[to] - a[to])) / (b[from] - a[from])
}
/** Scroll fraction (0..1) to story progress. */
export function storyFromScroll(s: number) {
  return interp(clamp01(s) * SCROLL_SVH, 1, 0)
}
/** Story progress to scroll fraction (0..1). */
export function scrollFromStory(p: number) {
  return interp(clamp01(p), 0, 1) / SCROLL_SVH
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
  /** The camera lowers to the water and the lanterns float out of the reeds, one after another. */
  lanternArrive: [0.806, 0.84] as [number, number],
  /** The lantern plateau: the buttons, titles and hint are live between [1] and [2]. */
  lanterns: [0.836, 0.842, 0.884, 0.888] as Range4,
  /** The paper shades lift off and rise into the sky, warming to gold as the sunset comes on. */
  lanternRise: [0.886, 0.93] as [number, number],
  sunset: [0.898, 0.909] as [number, number],
  burn: [0.905, 0.916] as [number, number],
  gather: [0.914, 0.926] as [number, number],
  about: [0.931, 0.937, 0.972, 0.9765] as Range4,
  tilt: [0.976, 0.9925] as [number, number],
  constellation2: [0.981, 0.994] as [number, number],
  contact: [0.987, 0.994, 2, 3] as Range4,
}

/** Where the lantern plateau rests: every lantern lit and settled in its arc. */
export const LANTERN_REST = 0.862

/**
 * The story's chapters, for the nav. `from` is where the chapter begins (for the highlight);
 * `to` is where a jump to it lands: the hero greeting, the Work heading before any role shows,
 * the lit lanterns, the album cards by the fire, and the finished constellation.
 */
export const SECTIONS = [
  { label: 'Intro', path: '/intro', from: 0, to: 0.16 },
  // the heading is fully in by 0.69 and the first role starts fading in just before 0.695
  { label: 'Work', path: '/work', from: T.work[0], to: 0.6925 },
  { label: 'Projects', path: '/projects', from: T.work[3], to: LANTERN_REST },
  { label: 'About', path: '/about', from: T.lanternRise[0], to: 0.955 },
  { label: 'Contact', path: '/contact', from: T.about[3], to: 1 },
] as const

/** The chapter a link like alicechen.art/work opens at, or -1 for the home page. */
export function sectionForPath(path: string) {
  const clean = path.toLowerCase().replace(/\.html$/, '').replace(/\/+$/, '')
  return SECTIONS.findIndex((s) => s.path === clean)
}

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
  list.push(
    { until: T.lanternRise[0], rest: LANTERN_REST },
    { until: 0.9275, rest: 0.921 },
    { until: 0.9775, rest: 0.955 },
    { until: 1.01, rest: 1 },
  )
  return list
}
