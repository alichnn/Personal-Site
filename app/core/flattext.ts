import { Color, Group, type ColorRepresentation } from 'three'
import { Text } from 'troika-three-text'

// Flat, vector-crisp text floating in the world (SDF, via troika-three-text), for everything
// that isn't a big 3D headline. A crisp outline sits on the glyph edge, and a soft blurred halo
// behind it keeps the words readable over busy clouds, grass and water.

export const FLAT_FONT = '/fonts/redaction-20-400.woff'
/** Clean (un-eroded) Redaction Bold, for the section headlines. */
export const HEADLINE_FONT = '/fonts/redaction-700.woff'

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
  /** Font file (defaults to Redaction 20). */
  font?: string
  /** Extra tracking, as a fraction of the font size. */
  letterSpacing?: number
}

export class FlatText {
  readonly group = new Group()
  width = 0
  height = 0
  private text = new Text()
  private halo = new Text()
  private size = 1
  private lines = 1
  private haloOpacity: number
  private baseColor: Color
  private haloColor: Color
  /** Current reveal opacity, so the hover glow can scale with it. */
  private alpha = 0
  private glowK = 0

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

  layout(l: FlatLayout) {
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
    // estimate until the layout worker reports back
    this.width = l.maxWidth ?? l.size * 8
    this.height = l.size * (l.lineHeight ?? 1.2) * this.lines
    this.halo.sync()
    this.text.sync(() => {
      const b = this.text.textRenderInfo?.blockBounds as number[] | undefined
      if (!b) return
      this.width = b[2]! - b[0]!
      const lineH = l.size * (l.lineHeight ?? 1.2)
      this.lines = Math.max(1, Math.round((b[3]! - b[1]!) / lineH))
      this.height = lineH * (this.lines - 1) + l.size * 0.72
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
    const dy = motion ? ((1 - ease(inAmt)) * -0.45 + ease(outAmt) * 0.35) * this.size : 0
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
