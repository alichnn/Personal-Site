import {
  Color,
  HalfFloatType,
  NeutralToneMapping,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js'
import type Lenis from 'lenis'
import { Atmosphere } from './atmosphere'
import { CameraRig } from './camera'
import { QUALITY, detectTier, lowerTier, type Quality } from './quality'
import { createScroll } from './scroll'
import { G, frameHooks, state, type Tier } from './state'
import { SCROLL_SVH, compositions, damp, storyFromScroll } from './timeline'
import { scrollToProgress } from './scroll'
import { groundHeight } from './layout'

import { Sky } from '../scenes/sky'
import { Clouds } from '../scenes/clouds'
import { Hero } from '../scenes/hero'
import { Night } from '../scenes/night'
import { Seeds } from '../scenes/seeds'
import { Terrain } from '../scenes/terrain'
import { Meadow } from '../scenes/meadow'
import { Bird } from '../scenes/bird'
import { Pond } from '../scenes/pond'
import { Campfire } from '../scenes/campfire'
import { Words } from '../scenes/words'

export interface WorldModule {
  /** Progress range in which the module is visible and updated. */
  range: [number, number]
  group: Object3D
  built: boolean
  build(w: World): void | Promise<void>
  update(w: World): void
  /** Runs after the camera has moved this frame (for things that follow the camera). */
  afterCamera?(w: World): void
  resize?(w: World): void
  setQuality?(q: Quality): void
}

export interface WorldOptions {
  canvas: HTMLCanvasElement
  fadeCanvas: HTMLCanvasElement
  reduced: boolean
  roleCount: number
  onLoadProgress(f: number): void
  onReady(): void
  onTier(t: Tier): void
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFlash: { value: 0 },
    uFlashColor: { value: new Color('#fff6e8') },
    uVignette: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb + uFlashColor * uFlash;
      vec2 d = vUv - 0.5;
      col *= 1.0 - dot(d, d) * uVignette;
      gl_FragColor = vec4(col, c.a);
    }`,
}

export let world: World | null = null

export class World {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(60, 1, 0.1, 2600)
  readonly rig: CameraRig
  readonly atmo: Atmosphere
  readonly composer: EffectComposer
  readonly bloom: UnrealBloomPass
  readonly grade: ShaderPass
  readonly lenis: Lenis
  quality: Quality

  readonly sky = new Sky()
  readonly clouds = new Clouds()
  readonly hero = new Hero()
  readonly night = new Night()
  readonly seeds = new Seeds()
  readonly terrain = new Terrain()
  readonly meadow = new Meadow()
  readonly bird = new Bird()
  readonly pond = new Pond()
  readonly campfire = new Campfire()
  readonly words = new Words()
  readonly modules: WorldModule[]

  /** White exposure flash (0..1), set by the cloud burst. */
  flash = 0
  ready = false

  private opts: WorldOptions
  private raf = 0
  private lastNow = 0
  private lastP = 0
  private comps
  private compIdx = -1
  private probe = { frames: 0, sum: 0, done: false, window: 0, windowFrames: 0, downgrades: 0 }
  private raycaster = new Raycaster()
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0)
  private tmp = new Vector3()
  private tmp2 = new Vector3()
  private disposed = false
  private frameCount = 0
  /** ?quality=… pins the tier (no automatic downgrades). */
  private forcedTier = new URLSearchParams(location.search).has('quality')

  constructor(opts: WorldOptions) {
    this.opts = opts
    state.reduced = opts.reduced
    this.comps = compositions(opts.roleCount)

    const renderer = (this.renderer = new WebGLRenderer({
      canvas: opts.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    }))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.type = PCFShadowMap
    renderer.shadowMap.autoUpdate = false

    const tier = detectTier(renderer)
    this.quality = QUALITY[tier]
    if (import.meta.dev) {
      // profiling overrides, e.g. ?msaa=0&dpr=1.5&shadows=0
      const q = new URLSearchParams(location.search)
      const o: Partial<Quality> = {}
      if (q.has('msaa')) o.msaa = +q.get('msaa')!
      if (q.has('dpr')) o.dpr = +q.get('dpr')!
      if (q.has('shadows')) o.shadows = q.get('shadows') === '1'
      if (q.has('bloom')) o.bloomScale = +q.get('bloom')!
      this.quality = { ...this.quality, ...o }
    }
    state.tier = tier
    opts.onTier(tier)

    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: this.quality.msaa })
    this.composer = new EffectComposer(renderer, target)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.3, 0.4, 0.9)
    this.composer.addPass(this.bloom)
    this.grade = new ShaderPass(GradeShader)
    this.composer.addPass(this.grade)
    this.composer.addPass(new OutputPass())
    this.composer.addPass(new FXAAPass())

    this.atmo = new Atmosphere(this.scene)
    this.rig = new CameraRig(this.camera)
    this.lenis = createScroll(opts.reduced)

    this.modules = [this.sky, this.clouds, this.hero, this.night, this.seeds, this.terrain, this.meadow, this.bird, this.pond, this.campfire, this.words]
    for (const m of this.modules) {
      m.group.visible = false
      this.scene.add(m.group)
    }

    this.applyShadows()
    this.resize()
    addEventListener('resize', this.resize)
    addEventListener('pointermove', this.onPointer, { passive: true })
    addEventListener('pointerdown', this.onPointer, { passive: true })
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave)
    world = this
    if (import.meta.dev) Object.assign(window, { __world: this, __goto: (p: number) => scrollToProgress(p, true) })
  }

  /** Loads the opening scenes, starts rendering, then streams the rest in the background. */
  async start() {
    const { onLoadProgress, onReady } = this.opts
    // Phase 1: the cloud world the loader lives in.
    await this.buildModule(this.sky)
    await this.buildModule(this.clouds)
    onLoadProgress(0.25)
    this.raf = requestAnimationFrame(this.frame)
    const t0 = performance.now()

    // Phase 2: everything up to the night sky.
    await this.buildModule(this.hero)
    onLoadProgress(0.5)
    await this.buildModule(this.night)
    onLoadProgress(0.7)
    await this.buildModule(this.seeds)
    await this.buildModule(this.words)
    onLoadProgress(1)
    // let the push into the clouds read as a beat, even on fast machines
    const minLoader = state.reduced ? 300 : 1400
    await new Promise((r) => setTimeout(r, Math.max(0, minLoader - (performance.now() - t0))))
    if (this.disposed) return
    this.ready = true
    state.loaded = true
    // scrolling unlocks at the visitor's first click (LoaderOverlay), which also starts the sound
    onReady()

    // Phase 3: stream later scenes during idle time, in scroll order.
    for (const m of [this.terrain, this.meadow, this.bird, this.pond, this.campfire]) {
      await idle()
      if (this.disposed) return
      await this.buildModule(m)
    }
  }

  private building = new Map<WorldModule, Promise<void>>()

  private buildModule(m: WorldModule) {
    if (m.built) return Promise.resolve()
    let job = this.building.get(m)
    if (!job) {
      job = (async () => {
        await m.build(this)
        m.setQuality?.(this.quality)
        m.resize?.(this)
        m.built = true
        // warm shaders off the critical path where supported (materials are collected synchronously)
        const was = m.group.visible
        m.group.visible = true
        const compiling = this.renderer.compileAsync(m.group, this.camera, this.scene)
        m.group.visible = was
        await compiling.catch(() => {})
      })()
      this.building.set(m, job)
    }
    return job
  }

  /** If scrolling outran the background loader, build what's needed right now. */
  private ensureBuilt(p: number) {
    for (const m of this.modules) {
      if (!m.built && p > m.range[0] - 0.06 && !this.building.has(m)) void this.buildModule(m)
    }
  }

  private applyShadows() {
    const on = this.quality.shadows
    this.renderer.shadowMap.enabled = on
    const sun = this.atmo.sun
    sun.castShadow = on
    if (on) {
      sun.shadow.mapSize.set(1024, 1024)
      const c = sun.shadow.camera
      c.left = c.bottom = -38
      c.right = c.top = 38
      c.near = 1
      c.far = 200
      sun.shadow.bias = -0.0006
      sun.shadow.normalBias = 0.04
    }
    this.scene.traverse((o: any) => {
      if (o.material?.isMeshToonMaterial) o.material.needsUpdate = true
    })
  }

  setTier(tier: Tier) {
    if (tier === this.quality.tier) return
    const shadowsChanged = QUALITY[tier].shadows !== this.quality.shadows
    this.quality = QUALITY[tier]
    state.tier = tier
    for (const m of this.modules) if (m.built) m.setQuality?.(this.quality)
    if (shadowsChanged) this.applyShadows()
    this.resize()
    // resizing clears the canvas; redraw now so a mid-frame downgrade doesn't flash blank
    if (this.ready) this.render()
    this.opts.onTier(tier)
  }

  resize = () => {
    const w = innerWidth, h = innerHeight
    state.width = w
    state.height = h
    const dpr = Math.min(devicePixelRatio || 1, this.quality.dpr)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(w, h)
    const s = this.quality.bloomScale * 2
    this.bloom.setSize(Math.round(w * dpr * s), Math.round(h * dpr * s))
    this.camera.aspect = w / h
    this.rig.narrow = Math.min(1, Math.max(0, (1 - w / h) / 0.45))
    this.camera.updateProjectionMatrix()
    for (const m of this.modules) if (m.built) m.resize?.(this)
  }

  private onPointer = (e: PointerEvent) => {
    const pt = state.pointer
    pt.x = e.clientX
    pt.y = e.clientY
    pt.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    pt.active = true
    pt.lastMove = state.time
    state.touch = e.pointerType === 'touch'
  }

  private onPointerLeave = () => {
    state.pointer.active = false
  }

  private updatePointer(dt: number) {
    const pt = state.pointer
    const live = pt.active && !state.reduced && state.time - pt.lastMove < (state.touch ? 0.6 : 4)
    G.uPointerStrength.value = damp(G.uPointerStrength.value, live ? 1 : 0, live ? 3 : 1.2, dt)
    if (!pt.active) return
    this.raycaster.setFromCamera(pt.ndc, this.camera)
    const ray = this.raycaster.ray
    // lag the ray a little so clouds part smoothly and drift back after the pointer leaves
    const k = 1 - Math.exp(-8 * dt)
    G.uPointerRayO.value.lerp(ray.origin, k)
    G.uPointerRayD.value.lerp(ray.direction, k).normalize()
    const c = this.camera.position
    this.groundPlane.constant = -groundHeight(c.x, c.z)
    if (ray.intersectPlane(this.groundPlane, this.tmp)) G.uPointerGround.value.lerp(this.tmp, k)
  }

  /** World position → CSS pixels. Returns false when behind the camera. */
  project(v: Vector3, out: { x: number; y: number }) {
    this.tmp2.copy(v).project(this.camera)
    out.x = (this.tmp2.x * 0.5 + 0.5) * state.width
    out.y = (-this.tmp2.y * 0.5 + 0.5) * state.height
    return this.tmp2.z < 1
  }

  private compIndex(p: number) {
    const i = this.comps.findIndex((c) => p < c.until)
    return i < 0 ? this.comps.length - 1 : i
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.05, this.lastNow ? (now - this.lastNow) / 1000 : 1 / 60)
    this.lastNow = now
    state.dt = dt
    state.time += dt
    G.uTime.value = state.time

    this.lenis.raf(now)
    const p = this.lenis.limit > 0 ? storyFromScroll(Math.min(1, Math.max(0, this.lenis.scroll / this.lenis.limit))) : 0
    const dp = p - this.lastP
    this.lastP = p
    state.speed = damp(state.speed, (dp * (SCROLL_SVH / 100)) / dt, 6, dt)
    state.idle = Math.abs(dp) > 1e-6 ? 0 : state.idle + dt
    state.p = p

    if (state.reduced) {
      const idx = this.compIndex(p)
      if (idx !== this.compIdx) {
        if (this.compIdx >= 0 && this.ready) this.snapshotForCrossfade()
        this.compIdx = idx
        this.rig.snap()
      }
      state.wp = this.comps[idx]!.rest
    } else {
      state.wp = p
    }
    const wp = state.wp

    this.ensureBuilt(wp)
    // Loader: push slowly into the cloud bank until ready, then settle onto the path.
    const push = this.ready ? 0 : Math.max(8, 46 - state.time * 9)
    this.rig.offset.z = this.ready ? damp(this.rig.offset.z, 0, 1.6, dt) : push

    this.atmo.update(wp)
    // per-frame effects that modules raise only while they're active
    this.flash = 0
    this.rig.fovKick = 0
    this.rig.shake = 0
    this.rig.override.weight = 0
    this.atmo.fireLight.intensity = 0
    G.uFireIntensity.value = 0
    state.fireFlicker = 0
    state.fireScreen.visible = false
    for (const m of this.modules) {
      const on = m.built && wp >= m.range[0] && wp <= m.range[1]
      m.group.visible = on
      if (on) m.update(this)
    }
    this.rig.update(dt, wp)
    this.updatePointer(dt)
    for (const m of this.modules) if (m.group.visible) m.afterCamera?.(this)

    if (this.quality.shadows && wp > 0.44) {
      this.camera.getWorldDirection(this.tmp).multiplyScalar(14).add(this.camera.position)
      this.tmp.y = groundHeight(this.tmp.x, this.tmp.z)
      this.atmo.aimShadow(this.tmp)
    }

    // shadows move slowly; refresh the shadow map every other frame
    this.renderer.shadowMap.needsUpdate = this.frameCount++ % 2 === 0
    this.render()
    for (const hook of frameHooks) hook()
    this.monitor(dt)
  }

  private render() {
    const [strength, radius, threshold] = this.atmo.bloom
    this.bloom.strength = strength
    this.bloom.radius = radius
    this.bloom.threshold = threshold
    this.grade.uniforms.uFlash!.value = this.flash
    this.composer.render()
  }

  /** Reduced motion: freeze the current frame on a 2D canvas and fade it out over the new one. */
  private snapshotForCrossfade() {
    const fc = this.opts.fadeCanvas
    const src = this.renderer.domElement
    fc.width = src.width
    fc.height = src.height
    const ctx = fc.getContext('2d')
    if (!ctx) return
    this.render()
    ctx.drawImage(src, 0, 0)
    fc.style.transition = 'none'
    fc.style.opacity = '1'
    void fc.offsetWidth
    fc.style.transition = 'opacity 1.4s ease'
    fc.style.opacity = '0'
  }

  /** Frame-time probe after load, then a slow watchdog that steps quality down if needed. */
  private monitor(dt: number) {
    if (!this.ready || document.hidden || this.forcedTier) return
    const pr = this.probe
    if (!pr.done) {
      pr.frames++
      if (pr.frames > 20) pr.sum += dt
      if (pr.frames >= 110) {
        pr.done = true
        const avg = pr.sum / 90
        if (avg > 1 / 40 && this.quality.tier !== 'low') this.downgrade()
      }
      return
    }
    pr.window += dt
    pr.windowFrames++
    if (pr.window > 4) {
      const avg = pr.window / pr.windowFrames
      pr.window = 0
      pr.windowFrames = 0
      if (avg > 1 / 27 && this.quality.tier !== 'low' && pr.downgrades < 2) this.downgrade()
    }
  }

  private downgrade() {
    this.probe.downgrades++
    this.setTier(lowerTier(this.quality.tier))
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.resize)
    removeEventListener('pointermove', this.onPointer)
    removeEventListener('pointerdown', this.onPointer)
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave)
    this.lenis.destroy()
    this.renderer.dispose()
    world = null
  }
}

function idle() {
  return new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 400 })
    else setTimeout(resolve, 30)
  })
}
