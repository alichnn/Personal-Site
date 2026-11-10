import { Color, Group, type ColorRepresentation } from 'three'
import { Text } from 'troika-three-text'

// Flat, vector-crisp text floating in the world (SDF, via troika-three-text), for everything
// that isn't a big 3D headline. A crisp outline sits on the glyph edge, and a soft blurred halo
// behind it keeps the words readable over busy clouds, grass and water.

/** Redaction 50 Regular (the textured cut): every sentence, role line and label. */
export const FLAT_FONT = '/fonts/redaction-50-400.woff'
/** Redaction 50 Bold (the textured cut), for the hero greeting. */
export const HERO_FONT = '/fonts/redaction-50-700.woff'
/** Section headlines share the hero's Redaction 50 Bold. */
export const HEADLINE_FONT = HERO_FONT
/** Redaction 50 Italic, for the quiet one-line captions under the roles. */
export const CAPTION_FONT = '/fonts/redaction-50-400-italic.woff'

export interface FlatLayout {
  /** Font size in world units. */
  size: number
  /** Wrap width in world units (no wrapping when omitted). */
  maxWidth?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  /** Which point of the block sits at the group's origin. */
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'middle' | 'bottom'
  /** Shrink the type until it wraps to at most this many lines. */
  maxLines?: number
  /** Wrap to evenly filled lines (no lone last word) within maxWidth. */
  balance?: boolean
}

export interface FlatStyle {
  color: ColorRepresentation
  /** Crisp outline hugging each glyph. */
  outline: ColorRepresentation
  /** Outline width as a fraction of the font size. */
  outlineWidth?: number
  /** Soft halo behind the text (defaults to the outline colour). */
  halo?: ColorRepresentation
  haloOpacity?: number
  /** Halo spread and softness, as fractions of the font size. */
  haloWidth?: number
  haloBlur?: number
  /** Font file (defaults to Redaction 50 Regular). */
  font?: string
  /** Extra tracking, as a fraction of the font size. */
  letterSpacing?: number
}

export class FlatText {
  readonly group = new Group()
  private text = new Text()
  private halo = new Text()
  private size = 1
  private lineHeight = 1.2
  private estWidth = 0
  private haloOpacity: number
  private baseColor: Color
  private haloColor: Color
  /** Current reveal opacity, so the hover glow can scale with it. */
  private alpha = 0
  private glowK = 0
  /** How far the text drifts as it fades (world units); defaults to its font size. Lines that
   *  share a drift move as one block, so a stack of differently sized lines never collides. */
  drift?: number

  constructor(content: string, private style: FlatStyle, layout: FlatLayout) {
    this.haloOpacity = style.haloOpacity ?? 0.42
    this.baseColor = new Color(style.color)
    this.haloColor = new Color(style.halo ?? style.outline)
    for (const t of [this.halo, this.text]) {
      t.text = content
      t.font = style.font ?? FLAT_FONT
      t.letterSpacing = style.letterSpacing ?? 0
      t.sdfGlyphSize = 64
      t.raycast = () => {}
    }
    const main = this.text
    main.color = this.baseColor.clone()
    main.outlineColor = new Color(style.outline)
    main.outlineBlur = '1.2%'
    main.renderOrder = 6
    const halo = this.halo
    halo.fillOpacity = 0
    halo.outlineColor = this.haloColor.clone()
    halo.outlineWidth = `${((style.haloWidth ?? 0.06) * 100).toFixed(1)}%`
    halo.outlineBlur = `${((style.haloBlur ?? 0.38) * 100).toFixed(1)}%`
    halo.renderOrder = 5
    halo.position.z = -0.002
    this.group.add(halo, main)
    this.layout(layout)
  }

  /** `then` runs once this layout has been measured (and wasn't superseded). */
  layout(l: FlatLayout, then?: () => void) {
    if (l.balance && l.maxWidth) return this.balanced(l)
    this.size = l.size
    const align = l.align ?? 'center'
    const anchorY = l.anchorY === 'top' ? 'top-cap' : l.anchorY === 'bottom' ? 'bottom-baseline' : 'middle'
    for (const t of [this.halo, this.text]) {
      t.fontSize = l.size
      t.maxWidth = l.maxWidth ?? Infinity
      t.lineHeight = l.lineHeight ?? 1.2
      t.textAlign = align
      t.anchorX = l.anchorX ?? 'center'
      t.anchorY = anchorY
      t.overflowWrap = 'break-word'
    }
    this.text.outlineWidth = `${((this.style.outlineWidth ?? 0.07) * 100).toFixed(1)}%`
    this.lineHeight = l.lineHeight ?? 1.2
    this.estWidth = l.maxWidth ?? l.size * 8
    const done = () => {
      // a newer layout (e.g. the shrink-to-fit below) supersedes this one
      if (!this.measured || l.size !== this.size) return
      if (l.maxLines && this.lines > l.maxLines) this.layout({ ...l, size: l.size * 0.94 }, then)
      else then?.()
    }
    this.halo.sync()
    this.text.sync(done)
    // troika skips the sync (and its callback) when nothing changed: the measurement is already current
    if (!(this.text as unknown as { _isSyncing?: boolean })._isSyncing) done()
  }

  /** Troika's latest measurement, once it matches the current size. */
  private get measured() {
    const info = this.text.textRenderInfo as { blockBounds?: number[]; parameters?: { fontSize?: number } } | null
    return info?.blockBounds && info.parameters?.fontSize === this.size ? info.blockBounds : null
  }

  get lines() {
    const b = this.measured
    return b ? Math.max(1, Math.round((b[3]! - b[1]!) / (this.size * this.lineHeight))) : 1
  }

  /** Block width in world units. */
  get width() {
    const b = this.measured
    return b ? b[2]! - b[0]! : this.estWidth
  }

  /** Cap-top of the first line to the baseline of the last, in world units. */
  get height() {
    return this.size * this.lineHeight * (this.lines - 1) + this.size * 0.72
  }

  /** Measure the text on one line, then wrap it at an even share of that width. */
  private balanced(l: FlatLayout) {
    const max = l.maxWidth!
    const lines = l.maxLines ?? Infinity
    this.layout({ ...l, balance: false, maxWidth: undefined, maxLines: undefined }, () => {
      const size = l.size
      let natural = this.width
      let fit = size
      // too long for the allowed lines even when full: shrink first
      if (natural > max * lines * 0.97) {
        fit = size * ((max * lines * 0.97) / natural)
        natural *= fit / size
      }
      const n = Math.max(1, Math.ceil(natural / max))
      this.layout({ ...l, balance: false, size: fit, maxWidth: n === 1 ? max : Math.min(max, (natural / n) * 1.1) })
    })
  }

  /** inAmt: 0→1 as the text appears; outAmt: 0→1 as it leaves. */
  setReveal(inAmt: number, outAmt: number, motion = true) {
    const ease = (x: number) => x * x * (3 - 2 * x)
    const a = ease(inAmt) * (1 - ease(outAmt))
    this.alpha = a
    this.text.fillOpacity = a
    this.text.outlineOpacity = a
    this.halo.outlineOpacity = a * (this.haloOpacity + (0.9 - this.haloOpacity) * this.glowK)
    const dy = motion ? ((1 - ease(inAmt)) * -0.45 + ease(outAmt) * 0.35) * (this.drift ?? this.size) : 0
    this.text.position.y = dy
    this.halo.position.y = dy
    this.group.visible = a > 0.003
  }

  /** Hover glow, 0..1.6: the word lights up white and a wide blue-white starlight halo blooms out. */
  set glow(v: number) {
    const k = Math.min(1, Math.max(0, v / 1.6))
    if (k === this.glowK) return
    this.glowK = k
    ;(this.text.color as Color).copy(this.baseColor).lerp(WHITE, k)
    ;(this.halo.outlineColor as Color).copy(this.haloColor).lerp(GLOW, k)
    this.halo.outlineWidth = `${((this.style.haloWidth ?? 0.06) + 0.12 * k) * 100}%`
    this.halo.outlineBlur = `${((this.style.haloBlur ?? 0.38) + 0.3 * k) * 100}%`
    this.halo.outlineOpacity = this.alpha * (this.haloOpacity + (0.9 - this.haloOpacity) * k)
  }

  dispose() {
    this.text.dispose()
    this.halo.dispose()
  }
}

const WHITE = new Color('#ffffff')
const GLOW = new Color('#4f6fff')
