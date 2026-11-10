import { Group, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import type { World, WorldModule } from '../core/world'
import { preloadFont } from 'troika-three-text'
import { CAPTION_FONT, FLAT_FONT, FlatText, HEADLINE_FONT, HERO_FONT, type FlatLayout, type FlatStyle } from '../core/flattext'
import { state } from '../core/state'
import { T, roleSlot, smooth, type Range4 } from '../core/timeline'
import { about, contacts, earth, goal, people, roles } from '../data/content'

// All story text, floating in the world, as flat, vector-crisp SDF text with a clean outline and
// a soft halo: headlines in Redaction Bold, sentences, paragraphs and labels in Redaction 20.
//
// Each line still exists as real HTML (for screen readers, search and keyboard focus) in the
// same responsive layout, just invisible ("ghost" text). This module measures where each ghost
// sits on screen at its section's resting camera pose and puts the lettering at that spot in
// the world, so CSS decides the layout and the letters live in the scene.

const UP = new Vector3(0, 1, 0)

interface Pose {
  pos: Vector3
  quat: Quaternion
  fwd: Vector3
  right: Vector3
  up: Vector3
  fov: number
}

interface GhostItem {
  sel: string
  /** Progress where the camera rests while this text holds. */
  rest: number
  /** Distance from the resting camera, in world units. */
  dist: number
  range: Range4
  style: FlatStyle
  /** Gentle float, in world units. */
  bob?: number
  letter?: FlatText
  anchor?: Vector3
  phase: number
}

/** Headline lettering: clean bold serif, a crisp outline and a tight, low-key shadow (no glow). */
const headline = (color: string, outline: string, shadow: string, extra: Partial<FlatStyle> = {}): FlatStyle => ({
  font: HEADLINE_FONT, color, outline, outlineWidth: 0.045, halo: shadow, haloOpacity: 0.32, haloWidth: 0.05, haloBlur: 0.22, letterSpacing: 0.01, ...extra,
})

// Night and firelit colours stay just under the bloom threshold so they don't smear.
const GHOSTS: GhostItem[] = [
  // closer than the photo frame (16) so the frame's little cloud never hides the letters
  { sel: '.hero-title', rest: 0.16, dist: 12, range: T.hero, style: headline('#ffffff', '#1a3a8f', '#0b1d55', { font: HERO_FONT, outlineWidth: 0.06, haloOpacity: 0.4 }), bob: 0.12, phase: 0 },
  { sel: '.people', rest: 0.235, dist: 24, range: T.people, style: { color: '#fffaf5', outline: '#211a5c', halo: '#120c3a' }, bob: 0.15, phase: 1 },
  { sel: '.goal .lede', rest: 0.375, dist: 26, range: T.goal, style: { color: '#cdd6f6', outline: '#0a1238', halo: '#02051a', haloOpacity: 0.6 }, bob: 0.15, phase: 2 },
  // daylight version of the earlier lines: warm cream letters, a dark-brown outline and only a tight shadow
  { sel: '.earth-copy', rest: 0.56, dist: 9, range: T.sign, style: { color: '#fff4e2', outline: '#4a2a10', halo: '#2a1608', haloOpacity: 0.3, haloWidth: 0.035, haloBlur: 0.2 }, bob: 0.04, phase: 3 },
  { sel: '.work-title', rest: 0.74, dist: 14, range: T.work, style: headline('#ffffff', '#0b3b3d', '#04201f'), bob: 0.05, phase: 4 },
  { sel: '.about-copy h2', rest: 0.91, dist: 7, range: T.about, style: headline('#f0d3ad', '#2a1205', '#0d0602', { haloOpacity: 0.5 }), bob: 0.02, phase: 5 },
  { sel: '.about-copy p', rest: 0.91, dist: 7, range: T.about, style: { color: '#f2dcbc', outline: '#2a1205', halo: '#0d0602', haloOpacity: 0.55 }, bob: 0.02, phase: 6 },
]

const ROLE_STYLE: FlatStyle = { color: '#f6fbfa', outline: '#0a3436', halo: '#04201f', haloOpacity: 0.5 }
const COMPANY_STYLE: FlatStyle = { ...ROLE_STYLE, color: '#a8efe1' }
/** The one-liner: a soft italic caption, paler and quieter than the two lines above it. */
const BLURB_STYLE: FlatStyle = { font: CAPTION_FONT, color: '#d6f3ec', outline: '#0a3436', outlineWidth: 0.05, halo: '#04201f', haloOpacity: 0.55, letterSpacing: 0.01 }
/** Space after each role line (title, company, one-liner), in CSS px at the pad's distance. */
const ROLE_GAPS = [12, 12, 0]
/** Starlight: as bright as it can be while staying just under the night bloom (which would smear bold
 *  letters), with a deep-blue halo to keep the edges crisp. Hovering still lights them up fully. */
const CONTACT_STYLE: FlatStyle = { font: HEADLINE_FONT, color: '#c9d2f4', outline: '#0d1a4a', outlineWidth: 0.05, halo: '#0a1440', haloOpacity: 0.55 }

/** Every character the flat text needs, so the font's glyph atlas is ready before the first reveal. */
/** Characters each headline font needs, read from the ghost text. */
const charsFor = (font: string) => GHOSTS.filter((g) => g.style.font === font).map((g) => document.querySelector(g.sel)?.textContent ?? '').join('')
const FLAT_CHARS = [people, goal, earth, about, ...roles.flatMap((r) => [r.role, r.company, r.line])].join('')
/** The contact words are set in the bold headline font. */
const CONTACT_CHARS = contacts.map((c) => c.label).join('')

export class Words implements WorldModule {
  range: [number, number] = [0, 1]
  group = new Group()
  built = false
  /** Hover glow per contact link, 0..1.6 (animated by the HTML links; objects so anime.js can tween them). */
  contactGlow: { v: number }[] = []
  private roleLetters: FlatText[][] = []
  private contactLetters: FlatText[] = []
  private contactLabels: HTMLElement[] = []
  private resizeTimer: ReturnType<typeof setTimeout> | null = null
  private m = new Matrix4()
  private tmp = new Vector3()
  private roleQuat = new Quaternion()

  async build(w: World) {
    await Promise.all([
      new Promise<void>((resolve) => preloadFont({ font: FLAT_FONT, characters: FLAT_CHARS }, resolve)),
      ...[HEADLINE_FONT, HERO_FONT].map((font) => new Promise<void>((resolve) => preloadFont({ font, characters: charsFor(font) + CONTACT_CHARS }, resolve))),
      new Promise<void>((resolve) => preloadFont({ font: CAPTION_FONT, characters: roles.map((r) => r.blurb).join('') }, resolve)),
    ])
    // the HTML ghost layout uses the same fonts; wait for them so the measurements match
    await Promise.all([
      document.fonts?.load('700 16px "Redaction 50"'),
      document.fonts?.load('400 16px "Redaction 50"'),
    ]).catch(() => {})
    this.layoutAll(w)
  }

  /** The camera's resting pose at progress p (without drift). */
  private pose(w: World, p: number): Pose {
    const pos = new Vector3(), look = new Vector3()
    const { fov } = w.rig.sample(p, pos, look)
    const quat = new Quaternion().setFromRotationMatrix(this.m.lookAt(pos, look, UP))
    const fwd = look.clone().sub(pos).normalize()
    const right = new Vector3().crossVectors(fwd, UP).normalize()
    const up = new Vector3().crossVectors(right, fwd)
    return { pos, quat, fwd, right, up, fov }
  }

  /** World units per CSS pixel at a distance in front of a camera with this fov. */
  private pxToWorld(fov: number, dist: number) {
    return (2 * dist * Math.tan(MathUtils.degToRad(fov / 2))) / innerHeight
  }

  private rolesReady = false

  private layoutAll(w: World) {
    for (const g of GHOSTS) this.layoutGhost(w, g)
    if (w.pond.built) {
      this.layoutRoles(w)
      this.rolesReady = true
    }
    this.layoutContacts(w)
  }

  private layoutGhost(w: World, g: GhostItem) {
    const el = document.querySelector<HTMLElement>(g.sel)
    if (!el) return
    const block = el.closest<HTMLElement>('.block')
    const r = el.getBoundingClientRect()
    // undo the block's scrub transform: blocks are full-viewport boxes at the origin
    const b = block?.getBoundingClientRect()
    const x = r.left - (b?.left ?? 0), y = r.top - (b?.top ?? 0)
    if (r.width < 1) return
    const cs = getComputedStyle(el)
    const pose = this.pose(w, g.rest)
    const k = this.pxToWorld(pose.fov, g.dist)
    const size = parseFloat(cs.fontSize) * k
    const align = cs.textAlign === 'left' || cs.textAlign === 'start' ? 'left' : cs.textAlign === 'right' ? 'right' : 'center'
    const layout: FlatLayout = {
      size,
      maxWidth: r.width * k * 1.03,
      lineHeight: (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2) / parseFloat(cs.fontSize),
      align,
      anchorX: align,
      anchorY: 'top',
    }
    if (!g.letter) {
      const text = el.textContent!.trim()
      g.letter = new FlatText(text, g.style, layout)
      this.group.add(g.letter.group)
    } else g.letter.layout(layout)

    // put the block where its ghost sits on screen, at the chosen depth
    const ax = align === 'left' ? x : align === 'right' ? x + r.width : x + r.width / 2
    // the first line's cap top sits roughly half a line-gap below the box top
    const capTop = y + (parseFloat(cs.lineHeight) - parseFloat(cs.fontSize) * 0.72) / 2
    const nx = (ax / innerWidth) * 2 - 1
    const ny = -((capTop / innerHeight) * 2 - 1)
    const hh = g.dist * Math.tan(MathUtils.degToRad(pose.fov / 2))
    const hw = hh * (innerWidth / innerHeight)
    g.anchor = pose.pos.clone().addScaledVector(pose.fwd, g.dist).addScaledVector(pose.right, nx * hw).addScaledVector(pose.up, ny * hh)
    g.letter.group.position.copy(g.anchor)
    g.letter.group.quaternion.copy(pose.quat)
  }

  private layoutRoles(w: World) {
    const pose = this.pose(w, 0.74)
    this.roleQuat.copy(pose.quat)
    roles.forEach((role, i) => {
      const d = pose.pos.distanceTo(w.pond.padBase(w, i))
      const k = this.pxToWorld(pose.fov, d)
      const narrow = innerWidth < 640
      const max = (narrow ? innerWidth * 0.8 : 440) * k
      // the one-liner may run a little wider than the title, and shrinks if it would need a third line
      const wide = (narrow ? innerWidth * 0.86 : 560) * k
      const layoutFor = (j: number, px: number) => (j === 2 ? { size: px * k, maxWidth: wide, anchorY: 'top' as const, maxLines: 2, balance: true } : { size: px * k, maxWidth: max, anchorY: 'top' as const })
      const specs: [string, FlatStyle, number][] = [
        [role.role, ROLE_STYLE, narrow ? 28 : 38],
        [`${role.company}, ${role.line}`, COMPANY_STYLE, narrow ? 23 : 29],
        [role.blurb, BLURB_STYLE, narrow ? 18 : 24],
      ]
      let lines = this.roleLetters[i]
      if (!lines) {
        lines = specs.map(([text, style, px], j) => new FlatText(text, style, layoutFor(j, px)))
        lines.forEach((l) => this.group.add(l.group))
        this.roleLetters[i] = lines
      } else specs.forEach(([, , px], j) => lines![j]!.layout(layoutFor(j, px)))
      lines.forEach((l) => {
        l.group.userData.k = k
        // the whole role (title, company, one-liner) rises and settles as one block
        l.drift = specs[0]![2] * k
      })
    })
  }

  private layoutContacts(w: World) {
    this.contactLabels = [...document.querySelectorAll<HTMLElement>('.star-label')]
    const k = this.pxToWorld(56, 30)
    this.contactLabels.forEach((el, i) => {
      const px = parseFloat(getComputedStyle(el).fontSize)
      const layout = { size: px * k * 1.15 }
      if (!this.contactLetters[i]) {
        this.contactLetters[i] = new FlatText(el.textContent!.trim(), CONTACT_STYLE, layout)
        this.group.add(this.contactLetters[i]!.group)
        this.contactGlow[i] = { v: 0 }
      } else this.contactLetters[i]!.layout(layout)
    })
  }

  resize(w: World) {
    if (!this.built) return
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.resizeTimer = setTimeout(() => this.layoutAll(w), 220)
  }

  update(w: World) {
    const p = state.p
    if (!this.rolesReady && w.pond.built) {
      this.layoutRoles(w)
      this.rolesReady = true
    }
    const t = state.time
    const motion = !state.reduced
    for (const g of GHOSTS) {
      if (!g.letter || !g.anchor) continue
      const [a, b, c, d] = g.range
      g.letter.setReveal(smooth(p, a, b), smooth(p, c, d), motion)
      if (g.letter.group.visible && motion && g.bob) {
        g.letter.group.position.copy(g.anchor)
        g.letter.group.position.y += Math.sin(t * 0.7 + g.phase) * g.bob
      }
    }

    // role lettering floats above each lily pad while that role is in focus
    this.roleLetters.forEach((lines, i) => {
      const f = w.pond.built ? w.pond.focus(i) : 0
      const [a, b] = roleSlot(i, roles.length)
      // before the slot's midpoint the role is arriving; after it, leaving
      const arriving = p < (a + b) / 2
      const base = w.pond.padAnchors[i]!
      const k = lines[0]!.group.userData.k as number
      const shift = lines[0]!.group.visible || lines[2]!.group.visible ? this.edgeShift(w, base, lines) : 0
      let y = this.stackHeight(lines)
      for (const [j, l] of lines.entries()) {
        l.setReveal(arriving ? f : 1, arriving ? 0 : 1 - f, motion)
        l.group.position.copy(base)
        l.group.position.y += 0.5 + (motion ? Math.sin(t * 0.9 + i) * 0.05 : 0)
        l.group.quaternion.copy(this.roleQuat)
        l.group.translateY(y)
        l.group.translateX(shift)
        y -= l.height + ROLE_GAPS[j]! * k
      }
    })

    // contact words sit beside their stars, facing the camera
    const cam = w.camera
    this.contactLetters.forEach((l, i) => {
      const el = this.contactLabels[i]
      l.setReveal(smooth(p, T.contact[0], T.contact[1]), 0, motion)
      if (!el || !l.group.visible) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      this.tmp.set((cx / innerWidth) * 2 - 1, -((cy / innerHeight) * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize()
      l.group.position.copy(cam.position).addScaledVector(this.tmp, 30)
      l.group.quaternion.copy(cam.quaternion)
      l.glow = this.contactGlow[i]?.v ?? 0
    })
  }

  /** Sideways nudge (world units) that keeps a role's widest line at least 16px inside the screen edges. */
  private edgeShift(w: World, base: Vector3, lines: FlatText[]) {
    const cam = w.camera
    const half = Math.max(...lines.map((l) => l.width)) / 2
    const dist = this.tmp.copy(base).sub(cam.position).length()
    const unitsPerNdc = dist * Math.tan(MathUtils.degToRad(cam.fov / 2)) * cam.aspect
    const x = this.tmp.copy(base).project(cam).x
    const hw = half / unitsPerNdc
    const m = 32 / innerWidth
    if (2 * (hw + m) >= 2) return -x * unitsPerNdc
    if (x - hw < -1 + m) return (-1 + m - (x - hw)) * unitsPerNdc
    if (x + hw > 1 - m) return (1 - m - (x + hw)) * unitsPerNdc
    return 0
  }

  private stackHeight(lines: FlatText[]) {
    const k = lines[0]!.group.userData.k as number
    return lines.reduce((a, l, j) => a + l.height + ROLE_GAPS[j]! * k, 0)
  }
}
