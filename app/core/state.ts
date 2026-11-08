import { Color, Vector2, Vector3 } from 'three'

export type Tier = 'high' | 'medium' | 'low'

/**
 * Per-frame shared state. Deliberately not Vue-reactive: it changes every frame and is read
 * by both the WebGL world and DOM overlays that update themselves imperatively.
 */
export const state = {
  /** Scroll progress 0 → 1 (what text and world events key on). */
  p: 0,
  /** World progress: equals p, except in reduced-motion mode where it snaps to compositions. */
  wp: 0,
  /** Scroll speed in viewport-heights per second (signed). */
  speed: 0,
  time: 0,
  dt: 0,
  /** Seconds since the last scroll movement. */
  idle: 0,
  tier: 'high' as Tier,
  reduced: false,
  touch: false,
  loaded: false,
  pointer: { ndc: new Vector2(-10, -10), x: -1, y: -1, active: false, lastMove: -10 },
  /** 0..1, raised while albums are hovered/focused so the camera holds still. */
  holdCamera: 0,
  /** 0..1 flicker of the campfire light, shared with the DOM cards. */
  fireFlicker: 0,
  fireScreen: { x: 0, y: 0, visible: false },
  width: 1,
  height: 1,
}

export type FrameHook = () => void
/** DOM overlays register here; called once per frame after the world renders. */
export const frameHooks = new Set<FrameHook>()

/** Uniforms shared by every custom shader in the world (same objects, not copies). */
export const G = {
  uTime: { value: 0 },
  uStars: { value: 0 },
  uRimColor: { value: new Color('#ffffff') },
  uRimStrength: { value: 0.8 },
  uSunDir: { value: new Vector3(0, 1, 0) },
  uSunColor: { value: new Color('#ffffff') },
  uSkyAmb: { value: new Color('#ffffff') },
  uGroundAmb: { value: new Color('#556644') },
  uFirePos: { value: new Vector3(0, -1000, 0) },
  uFireColor: { value: new Color('#ff9a4a') },
  uFireIntensity: { value: 0 },
  uWind: { value: 0 },
  uGust: { value: 0 },
  uPointerGround: { value: new Vector3(0, -1000, 0) },
  uPointerRayO: { value: new Vector3(0, -1000, 0) },
  uPointerRayD: { value: new Vector3(0, 0, -1) },
  uPointerStrength: { value: 0 },
}
