// troika-three-text ships without TypeScript types; this covers the parts the site uses.
declare module 'troika-three-text' {
  import { Mesh } from 'three'
  export class Text extends Mesh {
    text: string
    font: string
    fontSize: number
    maxWidth: number
    lineHeight: number | 'normal'
    letterSpacing: number
    textAlign: 'left' | 'right' | 'center' | 'justify'
    anchorX: number | string
    anchorY: number | string
    overflowWrap: 'normal' | 'break-word'
    color: unknown
    fillOpacity: number
    outlineWidth: number | string
    outlineColor: unknown
    outlineBlur: number | string
    outlineOpacity: number
    sdfGlyphSize: number
    textRenderInfo: { blockBounds: number[] } | null
    sync(callback?: () => void): void
    dispose(): void
  }
  export function preloadFont(options: { font: string; characters?: string }, callback: () => void): void
}
