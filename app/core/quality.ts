import type { WebGLRenderer } from 'three'
import type { Tier } from './state'

export interface Quality {
  tier: Tier
  /** Pixel ratio cap. */
  dpr: number
  /** MSAA samples on the main render target (expensive on half-float targets; FXAA covers edges). */
  msaa: number
  grass: number
  stars: number
  /** Multiplier on particle counts (embers, fireflies, wisps). */
  particles: number
  seeds: number
  /** Fraction of cloud clusters kept. */
  clouds: number
  shadows: boolean
  /** Bloom's first mip as a fraction of the screen. */
  bloomScale: number
}

export const QUALITY: Record<Tier, Quality> = {
  high: { tier: 'high', dpr: 1.5, msaa: 0, grass: 100000, stars: 3600, particles: 1, seeds: 220, clouds: 1, shadows: true, bloomScale: 0.5 },
  medium: { tier: 'medium', dpr: 1.25, msaa: 0, grass: 42000, stars: 2400, particles: 0.6, seeds: 150, clouds: 0.72, shadows: false, bloomScale: 0.35 },
  low: { tier: 'low', dpr: 1, msaa: 0, grass: 16000, stars: 1500, particles: 0.35, seeds: 90, clouds: 0.5, shadows: false, bloomScale: 0.25 },
}

export const lowerTier = (t: Tier): Tier => (t === 'high' ? 'medium' : 'low')

/** First guess from the GPU string and device signals; refined by a frame-time probe later. */
export function detectTier(renderer: WebGLRenderer): Tier {
  const forced = new URLSearchParams(location.search).get('quality')
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced

  const gl = renderer.getContext()
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase()
  const coarse = matchMedia('(pointer: coarse)').matches
  const phone = coarse && Math.min(screen.width, screen.height) < 820
  const tablet = coarse && !phone
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8

  if (/swiftshader|llvmpipe|software|microsoft basic/.test(gpu)) return 'low'

  let score = phone ? 1 : tablet ? 1.5 : 2
  if (/apple m\d|rtx|radeon (rx|pro)|geforce|arc a\d|apple gpu/.test(gpu) && !phone) score = Math.max(score, 2)
  if (/intel.*(hd|uhd) graphics|mali-g[0-5]\d\b|mali-t|adreno.*[3-5]\d\d\b|powervr/.test(gpu)) score -= 1
  if (cores <= 4 || mem <= 3) score -= 0.5
  if (window.devicePixelRatio > 2.5 && phone) score -= 0.25

  return score >= 2 ? 'high' : score >= 1 ? 'medium' : 'low'
}
